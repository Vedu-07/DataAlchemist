import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  DataRow,
  Rule,
  AllocationAnalysisResponse,
  CoRunRule,
  SlotRestrictionRule,
  LoadLimitRule,
  PhaseWindowRule,
  PatternMatchRule,
  PrecedenceOverrideRule,
  NaturalLanguageRule,
} from '@/types'; 

export async function POST(request: Request) {
  try {
    const { clientsData, workersData, tasksData, rules }: { clientsData: DataRow[]; workersData: DataRow[]; tasksData: DataRow[]; rules: Rule[]; } = await request.json();

    if (!clientsData || !workersData || !tasksData) {
      return new Response(JSON.stringify({ success: false, message: 'Missing client, worker, or task data for analysis.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.NEXT_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Missing NEXT_GEMINI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Using gemini-2.0-flash

    const activeRules = rules.filter(rule => rule.isEnabled);

    const precedenceRule = activeRules.find((rule): rule is PrecedenceOverrideRule => rule.type === 'precedenceOverride');

    const rulesMap = new Map(activeRules.map(rule => [rule.id, rule]));

    let orderedRules: Rule[];
    if (precedenceRule && precedenceRule.ruleIds && precedenceRule.ruleIds.length > 0) {
      orderedRules = precedenceRule.ruleIds
        .map(ruleId => rulesMap.get(ruleId))
        .filter((rule): rule is Rule => rule !== undefined && rule.isEnabled && rule.type !== 'precedenceOverride');

      const rulesNotInPrecedence = activeRules.filter(
        rule => rule.type !== 'precedenceOverride' && !orderedRules.some(ordered => ordered.id === rule.id)
      );
      orderedRules = [...orderedRules, ...rulesNotInPrecedence];
    } else {
      orderedRules = activeRules.filter(rule => rule.type !== 'precedenceOverride');
    }

    const detailedRulesForPrompt = orderedRules.map(rule => {
      let ruleDetails = `  - ID: ${rule.id}, Type: ${rule.type}, Description: "${rule.description}"`;
      switch (rule.type) {
        case 'coRun':
          const coRunRule = rule as CoRunRule;
          ruleDetails += ` Tasks to co-run: [${coRunRule.taskIds.join(', ')}]`;
          break;
        case 'slotRestriction':
          const slotRule = rule as SlotRestrictionRule;
          ruleDetails += ` Group Type: ${slotRule.groupType}, Group Name: ${slotRule.groupName}, Min Common Slots: ${slotRule.minCommonSlots}`;
          if (slotRule.targetPhases && slotRule.targetPhases.length > 0) {
            ruleDetails += `, Target Phases: [${slotRule.targetPhases.join(', ')}]`;
          }
          break;
        case 'loadLimit':
          const loadRule = rule as LoadLimitRule;
          ruleDetails += ` Worker Group: ${loadRule.workerGroup}, Max Load: ${loadRule.maxLoad}`;
          if (typeof loadRule.phase === 'number') {
            ruleDetails += `, Specific Phase: ${loadRule.phase}`;
          }
          break;
        case 'phaseWindow':
          const phaseRule = rule as PhaseWindowRule;
          ruleDetails += ` Task ID: ${phaseRule.taskId}, Allowed Phases: [${phaseRule.allowedPhases.join(', ')}]`;
          break;
        case 'patternMatch':
          const patternRule = rule as PatternMatchRule;
          ruleDetails += ` Entity: ${patternRule.entity}, Column: ${patternRule.column}, Regex: "${patternRule.regex}", Action: ${patternRule.action}`;
          if (patternRule.action === 'transform' && patternRule.actionDetails?.transformTo) {
            ruleDetails += `, Transform To: "${patternRule.actionDetails.transformTo}"`;
          } else if (patternRule.action === 'flag' && patternRule.actionDetails?.message) {
            ruleDetails += `, Flag Message: "${patternRule.actionDetails.message}"`;
          }
          break;
        case 'naturalLanguage':
          const nlRule = rule as NaturalLanguageRule;
          ruleDetails += ` Original Prompt: "${nlRule.originalPrompt}"`;
          if (nlRule.suggestedStructuredRule) {
            ruleDetails += `, AI interpreted structured rule: ${JSON.stringify(nlRule.suggestedStructuredRule)}`;
          }
          break;
      }
      return ruleDetails;
    }).join('\n');

    const rulesForPrompt = orderedRules.length > 0
      ? `\n**Active Business Rules (Applied in Order):**\n${detailedRulesForPrompt}\n`
      : "No specific business rules defined by the user.";

    const clientsSample = clientsData.slice(0, Math.min(clientsData.length, 20));
    const workersSample = workersData.slice(0, Math.min(workersData.length, 20));
    const tasksSample = tasksData.slice(0, Math.min(tasksData.length, 20));

    const dataForPrompt = `
      ${clientsSample.length > 0 ? `### Clients Data Sample (first ${clientsSample.length} rows):\n${JSON.stringify(clientsSample, null, 2)}\n` : ''}
      ${workersSample.length > 0 ? `### Workers Data Sample (first ${workersSample.length} rows):\n${JSON.stringify(workersSample, null, 2)}\n` : ''}
      ${tasksSample.length > 0 ? `### Tasks Data Sample (first ${tasksSample.length} rows):\n${JSON.stringify(tasksSample, null, 2)}\n` : ''}
    `;

    const responseSchemaDefinition = { 
      type: "object",
      properties: {
        overallStatus: {
          type: "string",
          enum: ["feasible", "challenged", "highly_challenged", "unknown"],
          description: "AI's high-level verdict on allocation feasibility."
        },
        bottlenecks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["skill_shortage", "capacity_overload", "rule_conflict", "data_quality", "unassigned_tasks", "other"], description: "Type of bottleneck." },
              message: { type: "string", description: "Plain-language description of the bottleneck. This field is REQUIRED and must be descriptive." },
              details: { type: "string", description: "More specific details if available." },
              relatedIds: { type: "array", items: { type: "string" }, description: "IDs of related entities." }
            },
            required: ["type", "message"] 
          },
          default: []
        },
        predictedRuleViolations: {
          type: "array",
          items: { type: "string" },
          description: "Plain-language descriptions of rules likely to be violated, especially explicit rules provided. Include the Rule ID for clarity.",
          default: []
        },
        predictedUnassignedTasksCount: {
          type: "number",
          description: "Estimated number of tasks that cannot be assigned due to current constraints.",
          default: 0
        },
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              message: { type: "string", description: "Plain-language recommendation. This field is REQUIRED and must be descriptive." },
              type: { type: "string", enum: ["adjust_data", "adjust_rules", "strategic_action", "re_evaluate_priorities"], description: "Type of recommendation." }
            },
            required: ["message", "type"] 
          },
          default: []
        },
        aiMessage: { type: "string", description: "Overall AI summary message." }
      },
      required: ["overallStatus", "bottlenecks", "predictedRuleViolations", "predictedUnassignedTasksCount", "recommendations", "aiMessage"]
    };

    const chatHistory = [
      {
        role: "user",
        parts: [
          { text: `
            You are an expert Resource Allocation Strategist AI.
            Your task is to analyze the provided Client, Worker, and Task data
            to assess the overall feasibility of resource allocation and identify any potential bottlenecks or conflicts.
            **You MUST apply the provided 'Active Business Rules' to the data during your analysis.**
            Provide your analysis in a structured, user-friendly JSON format.

            **Instructions:**
            1.  **Overall Status:**
                * If significant data quality issues (e.g., invalid durations, non-existent references) or severe resource constraints that prevent substantial allocation, or if many explicit rules are violated, the status MUST be 'highly_challenged'.
                * If there are noticeable but manageable imbalances, minor issues, or a few explicit rule violations, use 'challenged'.
                * If all data is sound, resources are sufficient, and no explicit rules are violated, use 'feasible'.
                * Only use 'unknown' if the data provided is completely insufficient or uninterpretable for any analysis.

            2.  **Bottlenecks:** Identify specific resource shortages (e.g., skills), capacity overloads, data quality issues, or logical conflicts based on the raw data AND the **application of the provided business rules**.
                For each bottleneck, provide:
                * A 'type' from:
                    * 'skill_shortage' (when workers lack skills needed by tasks)
                    * 'capacity_overload' (when workers are assigned too many tasks or too long durations)
                    * 'data_quality' (for invalid data points like negative durations, missing IDs, or incorrect formats)
                    * 'rule_conflict' (when a provided business rule is violated)
                    * 'unassigned_tasks' (tasks that cannot be allocated)
                    * 'other' (for any other general bottleneck)
                * A **clear, concise, and descriptive 'message'** explaining the issue. This message is REQUIRED and MUST NOT be empty.
                * Include 'details' and 'relatedIds' (e.g., IDs of rules, tasks, workers) if relevant.
                Only include bottlenecks if they are genuinely present and clearly identifiable.

            3.  **Predicted Rule Violations:** List explicit rules (by ID and description) that are likely to be violated when attempting allocation given the data and other constraints. This array MUST include violations of the 'Active Business Rules' provided below. If a rule cannot be met, explain why.

            4.  **Predicted Unassigned Tasks:** Estimate how many tasks might remain unassigned if these constraints (data + rules) are applied. If this count is zero, state 0.

            5.  **Recommendations:** Offer actionable, high-level advice to resolve identified issues based purely on the data's capabilities and demands AND the rules.
                For each recommendation, provide:
                * A **clear, concise, and descriptive 'message'** on how to resolve the issue. This message is REQUIRED and MUST NOT be empty.
                * A 'type' from:
                    * 'adjust_data' (for recommendations involving correcting or modifying input data)
                    * 'adjust_rules' (for recommendations suggesting changes to the business rules themselves, e.g., if a rule is too restrictive or contradictory)
                    * 'strategic_action' (for broader, long-term actions like training or hiring)
                    * 're_evaluate_priorities' (for suggesting changes in task or client priorities)
                Only include recommendations if issues (bottlenecks or predicted unassigned tasks/violations) are found.

            6.  **AI Message:** Provide a concise overall summary of your analysis, highlighting the most critical findings and the impact of the applied rules.

            **Data for Analysis:**
            ${dataForPrompt}

            ${rulesForPrompt} <!-- Rules are injected here -->

            Your output MUST be a JSON object adhering strictly to the following JSON schema.
            ${JSON.stringify(responseSchemaDefinition, null, 2)}
            Ensure all array properties are present, even if empty.
            Each object within 'bottlenecks' and 'recommendations' arrays MUST contain both 'type' and a non-empty 'message' property.
            `},
        ],
      },
    ];

    const result = await model.generateContent({
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('No valid JSON response from AI for allocation analysis.');
    }

    let aiResponse: AllocationAnalysisResponse;
    try {
      aiResponse = JSON.parse(responseText);
      aiResponse.bottlenecks = Array.isArray(aiResponse.bottlenecks) ? aiResponse.bottlenecks : [];
      aiResponse.predictedRuleViolations = Array.isArray(aiResponse.predictedRuleViolations) ? aiResponse.predictedRuleViolations : [];
      aiResponse.recommendations = Array.isArray(aiResponse.recommendations) ? aiResponse.recommendations : [];

      console.log('Gemini AI Allocation Analysis Response:', JSON.stringify(aiResponse, null, 2));

    } catch (err: unknown) {
      let errorMessage = 'Failed to parse JSON from AI allocation analysis response.';
      if (err instanceof Error) {
        errorMessage += ` Error: ${err.message}`;
      }
      console.error("JSON parse error from AI for allocation analysis:", err);
      console.error("Raw AI response leading to parse error:", responseText);
      throw new Error(`${errorMessage}. Raw response: ${responseText}`);
    }

    const apiResponse: AllocationAnalysisResponse = {
      success: true,
      message: aiResponse.message || 'AI allocation analysis complete.',
      overallStatus: aiResponse.overallStatus,
      bottlenecks: aiResponse.bottlenecks,
      predictedRuleViolations: aiResponse.predictedRuleViolations,
      predictedUnassignedTasksCount: aiResponse.predictedUnassignedTasksCount,
      recommendations: aiResponse.recommendations,
    };

    return new Response(JSON.stringify(apiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred during AI allocation analysis.';
    if (error instanceof Error) {
      errorMessage = `Failed AI allocation analysis: ${error.message}`;
    }
    console.error('API Error during AI allocation analysis:', error);
    return new Response(JSON.stringify({
      success: false,
      message: errorMessage,
      error: error instanceof Error ? error.message : String(error),
      overallStatus: 'unknown',
      bottlenecks: [],
      predictedRuleViolations: [],
      predictedUnassignedTasksCount: 0,
      recommendations: [],
    } as AllocationAnalysisResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
