// src/app/api/analyze-allocation/route.ts

// This API route takes loaded client, worker, and task data, along with all active rules,
// and uses Gemini to analyze the feasibility of resource allocation and identify bottlenecks.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { DataRow, Rule, AllocationAnalysisResponse, AllocationBottleneck, AllocationRecommendation } from '@/types';

export async function POST(request: Request) {
  try {
    // Note: 'rules' parameter will now be an empty array if not supplied from frontend
    const { clientsData, workersData, tasksData, rules }: { clientsData: DataRow[]; workersData: DataRow[]; tasksData: DataRow[]; rules: Rule[]; } = await request.json();

    // Basic validation for input data
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

    // Prepare data samples for Gemini (limit to first 10-20 rows for token efficiency)
    const clientsSample = clientsData.slice(0, Math.min(clientsData.length, 20));
    const workersSample = workersData.slice(0, Math.min(workersData.length, 20));
    const tasksSample = tasksData.slice(0, Math.min(tasksData.length, 20));

    // Prepare rules for Gemini - this will be an empty string if no rules are provided from the frontend
    const rulesForPrompt = rules && rules.length > 0 ? rules.map(rule => `- ID: ${rule.id}, Type: ${rule.type}, Description: "${rule.description}", Enabled: ${rule.isEnabled}`).join('\n') : "No specific rules defined.";

    const dataForPrompt = `
      ${clientsSample.length > 0 ? `### Clients Data Sample (first ${clientsSample.length} rows):\n${JSON.stringify(clientsSample, null, 2)}\n` : ''}
      ${workersSample.length > 0 ? `### Workers Data Sample (first ${workersSample.length} rows):\n${JSON.stringify(workersSample, null, 2)}\n` : ''}
      ${tasksSample.length > 0 ? `### Tasks Data Sample (first ${tasksSample.length} rows):\n${JSON.stringify(tasksSample, null, 2)}\n` : ''}
    `;

    // Define the structured JSON schema for AI's response - AllocationAnalysisResponse
    // This part is crucial for guiding the AI's output format.
    const responseSchema = {
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
              type: { type: "string", enum: ["skill_shortage", "capacity_overload", "rule_conflict", "unassigned_tasks", "other"], description: "Type of bottleneck." },
              message: { type: "string", description: "Plain-language description of the bottleneck. This field is REQUIRED and must be descriptive." },
              details: { type: "string", description: "More specific details if available." },
              relatedIds: { type: "array", items: { type: "string" }, description: "IDs of related entities." }
            },
            required: ["type", "message"] // Explicitly mark message as required for AI
          },
          default: []
        },
        predictedRuleViolations: {
          type: "array",
          items: { type: "string" },
          description: "Plain-language descriptions of rules likely to be violated. (Note: These would only appear if rules were explicitly considered by the AI.)",
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
            required: ["message", "type"] // Explicitly mark message as required for AI
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
            Provide your analysis in a structured, user-friendly JSON format.

            **Instructions:**
            1.  **Overall Status:**
                * If significant data quality issues (e.g., invalid durations, non-existent references) or severe resource constraints are present, the status MUST be 'highly_challenged'.
                * If there are noticeable but manageable imbalances or minor issues, use 'challenged'.
                * If all appears well and allocation seems straightforward, use 'feasible'.
                * Only use 'unknown' if the data provided is completely insufficient or uninterpretable for any analysis.

            2.  **Bottlenecks:** Identify specific resource shortages (e.g., skills), capacity overloads, or logical conflicts based on the raw data.
                For each bottleneck, provide:
                * A 'type' from:
                    * 'skill_shortage' (when workers lack skills needed by tasks)
                    * 'capacity_overload' (when workers are assigned too many tasks or too long durations)
                    * 'data_quality' (for invalid data points like negative durations, missing IDs, or incorrect formats)
                    * 'rule_conflict' (if any explicit rules were provided and violated, but primarily for implicit conflicts in this context)
                    * 'other' (for any other general bottleneck)
                * A **clear, concise, and descriptive 'message'** explaining the issue. This message is REQUIRED and MUST NOT be empty.
                * Include 'details' and 'relatedIds' if relevant.
                Only include bottlenecks if they are genuinely present and clearly identifiable.

            3.  **Predicted Rule Violations:** Since no explicit rules are defined by the user in this interaction, focus on implicit "best practice" violations if discernible from data patterns (e.g., a task requiring a specific skill where no worker has it). If no such implicit violations are clear, this array should be empty.

            4.  **Predicted Unassigned Tasks:** Estimate how many tasks might remain unassigned if these constraints are applied. If this count is zero, state 0.

            5.  **Recommendations:** Offer actionable, high-level advice to resolve identified issues based purely on the data's capabilities and demands.
                For each recommendation, provide:
                * A **clear, concise, and descriptive 'message'** on how to resolve the issue. This message is REQUIRED and MUST NOT be empty.
                * A 'type' from:
                    * 'adjust_data' (for recommendations involving correcting or modifying input data)
                    * 'adjust_rules' (if explicit rules were in play, but for this context, implies data-driven policy adjustments)
                    * 'strategic_action' (for broader, long-term actions like training or hiring)
                    * 're_evaluate_priorities' (for suggesting changes in task or client priorities)
                Only include recommendations if issues (bottlenecks or predicted unassigned tasks/violations) are found.

            6.  **AI Message:** Provide a concise overall summary of your analysis, highlighting the most critical findings.

            **Data for Analysis:**
            ${dataForPrompt}

            **Active Rules:**
            ${rulesForPrompt}

            Your output MUST be a JSON object adhering strictly to the provided JSON schema.
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
      // You can also provide schema for Gemini if using models that support it more directly,
      // but the prompt guidance is often more effective for specific content requirements.
      // tools: [
      //   {
      //     functionDeclarations: [
      //       {
      //         name: "allocationAnalysis",
      //         description: "Provides an analysis of resource allocation feasibility and identifies bottlenecks.",
      //         parameters: responseSchema,
      //       },
      //     ],
      //   },
      // ],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('No valid JSON response from AI for allocation analysis.');
    }

    let aiResponse: AllocationAnalysisResponse;
    try {
      aiResponse = JSON.parse(responseText);
      // Ensure arrays are arrays even if Gemini sends null/undefined/empty object
      aiResponse.bottlenecks = Array.isArray(aiResponse.bottlenecks) ? aiResponse.bottlenecks : [];
      aiResponse.predictedRuleViolations = Array.isArray(aiResponse.predictedRuleViolations) ? aiResponse.predictedRuleViolations : [];
      aiResponse.recommendations = Array.isArray(aiResponse.recommendations) ? aiResponse.recommendations : [];

      console.log('Gemini AI Allocation Analysis Response:', JSON.stringify(aiResponse, null, 2));

    } catch (err: any) {
      console.error("JSON parse error from AI for allocation analysis:", err);
      // Log the raw response text that caused the parsing error
      console.error("Raw AI response leading to parse error:", responseText);
      throw new Error('Failed to parse JSON from AI allocation analysis response: ' + responseText);
    }

    const apiResponse: AllocationAnalysisResponse = {
      success: true,
      message: aiResponse.message || 'AI allocation analysis complete.', // Use aiMessage for top-level message
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

  } catch (error: any) {
    console.error('API Error during AI allocation analysis:', error);
    return new Response(JSON.stringify({
      success: false,
      message: `Failed AI allocation analysis: ${error.message || 'An unknown error occurred.'}`,
      error: error.message,
      overallStatus: 'unknown',
      bottlenecks: [],
      predictedRuleViolations: [],
      predictedUnassignedTasksCount: 0,
      recommendations: [],
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}