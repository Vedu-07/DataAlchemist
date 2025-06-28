import { GoogleGenerativeAI } from '@google/generative-ai';
// No need to import Schema explicitly, it's inferred by the library's types
import { Rule, GeminiRuleConversionResponse, NaturalLanguageRule } from '@/types'; // Import necessary types

// POST handler for the API route
export async function POST(request: Request) {
  try {
    // Parse the request body to get the natural language prompt
    const { prompt } = await request.json();

    // Basic validation for the prompt
    if (!prompt) {
      return new Response(JSON.stringify({ success: false, message: 'Prompt is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize the GoogleGenerativeAI client
    // CRITICAL FIX: In the Canvas environment, leave apiKey as an empty string.
    // The Canvas runtime will automatically provide the API key.
        const apiKey = process.env.NEXT_GEMINI_API_KEY;

        if (!apiKey) {
        throw new Error("Missing NEXT_GEMINI_API_KEY environment variable");
        }

        const genAI = new GoogleGenerativeAI(apiKey);

    // Select the Gemini Pro model for text generation and structured output
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Using gemini-2.0-flash as instructed

    // Define the JSON schema for the expected structured rule output.
    // This guides Gemini to generate a rule object that matches our TypeScript interfaces.
    // FIX: Removed `nullable: true` from properties as it's not directly supported by the SDK's Schema type definition here.
    // Optionality is handled by not including a property in the generated JSON if not applicable.
    const ruleSchema = {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["coRun", "slotRestriction", "loadLimit", "phaseWindow", "patternMatch", "precedenceOverride"]
        },
        description: { type: "string" },
        isEnabled: { type: "boolean" },
        // Properties specific to different rule types - removed `nullable: true`
        taskIds: { type: "array", items: { type: "string" } }, // For coRun
        groupType: { type: "string", enum: ["clientGroup", "workerGroup"] }, // For slotRestriction
        groupName: { type: "string" }, // For slotRestriction, loadLimit
        minCommonSlots: { type: "number" }, // For slotRestriction
        maxLoad: { type: "number" }, // For loadLimit
        phase: { type: "number" }, // For loadLimit
        taskId: { type: "string" }, // For phaseWindow
        allowedPhases: {
          type: "array",
          items: { type: ["number", "string"] }, // Can be numbers or string ranges like "4-6"
        }, // For phaseWindow
        entity: { type: "string", enum: ["clients", "workers", "tasks"] }, // For patternMatch
        column: { type: "string" }, // For patternMatch
        regex: { type: "string" }, // For patternMatch
        action: { type: "string", enum: ["flag", "transform"] }, // For patternMatch
        actionDetails: {
          type: "object",
          properties: {
            transformTo: { type: "string" },
            message: { type: "string" }
          },
        }, // For patternMatch
        ruleIds: { type: "array", items: { type: "string" } } // For precedenceOverride
      },
      required: ["type", "description", "isEnabled"] // Base properties always required
    };

    // The prompt for Gemini to convert natural language to a structured rule.
    // It's crucial to give Gemini clear instructions and context about the expected output format.
    const chatHistory = [
      {
        role: "user",
        parts: [
          { text: `
            You are an expert in converting natural language business rules into a strict JSON format based on predefined types.
            The available rule types are: 'coRun', 'slotRestriction', 'loadLimit', 'phaseWindow', 'patternMatch', 'precedenceOverride'.
            Your output MUST be a JSON object adhering to the provided JSON schema.
            If a property is not applicable for a specific rule type, omit it. DO NOT include properties that are not applicable to the rule.
            Ensure 'isEnabled' is always true by default, and 'description' accurately summarizes the rule.
            
            Here are the definitions of each rule type:
            - coRun: Tasks that must be executed together by the same worker. Requires 'taskIds' (array of strings).
            - slotRestriction: Constraints on client or worker groups regarding minimum common slots. Requires 'groupType' ('clientGroup'|'workerGroup'), 'groupName' (string), 'minCommonSlots' (number). Optional: 'targetPhases' (array of numbers).
            - loadLimit: Maximum workload per phase for a selected worker group. Requires 'workerGroup' (string), 'maxLoad' (number). Optional: 'phase' (number).
            - phaseWindow: Allowed phase lists or ranges for specific tasks. Requires 'taskId' (string), 'allowedPhases' (array of numbers or strings like "1-3").
            - patternMatch: Apply a rule based on a regex pattern match (e.g., on task name). Requires 'entity' ('clients'|'workers'|'tasks'), 'column' (string), 'regex' (string), 'action' ('flag'|'transform'). Optional: 'actionDetails' (object with 'transformTo' or 'message').
            - precedenceOverride: Define explicit priority order for rules. Requires 'ruleIds' (array of strings of existing rule IDs).

            Example Conversions:
            User: "Make sure tasks T1 and T2 are always done together."
            AI: { "type": "coRun", "description": "Tasks T1 and T2 must always be done together.", "isEnabled": true, "taskIds": ["T1", "T2"] }

            User: "For the 'VIP Clients' group, they need at least 5 common slots in any phase."
            AI: { "type": "slotRestriction", "description": "VIP Clients need at least 5 common slots in any phase.", "isEnabled": true, "groupType": "clientGroup", "groupName": "VIP Clients", "minCommonSlots": 5 }

            User: "Workers in 'DevTeam' should not exceed 10 units of load per phase, specifically for phase 3."
            AI: { "type": "loadLimit", "description": "DevTeam workers max load is 10 in phase 3.", "isEnabled": true, "workerGroup": "DevTeam", "maxLoad": 10, "phase": 3 }

            User: "Task T5 can only be in phases 1, 2, or 3-5."
            AI: { "type": "phaseWindow", "description": "Task T5 is limited to phases 1, 2, or 3-5.", "isEnabled": true, "taskId": "T5", "allowedPhases": [1, 2, "3-5"] }

            User: "If a client's name contains 'Corp' flag it as a potential corporate client."
            AI: { "type": "patternMatch", "description": "Flag clients with 'Corp' in their name.", "isEnabled": true, "entity": "clients", "column": "clientName", "regex": "Corp", "action": "flag", "actionDetails": { "message": "Potential corporate client" } }

            User: "Set the order of rules to R1, R3, then R2."
            AI: { "type": "precedenceOverride", "description": "Override rule precedence to R1, R3, R2.", "isEnabled": true, "ruleIds": ["R1", "R3", "R2"] }

            Now, convert the following natural language request into a structured JSON rule:
            "${prompt}"
          `}
        ],
      },
    ];

    // Call Gemini with the prompt and the defined schema
    const result = await model.generateContent({
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "application/json", // Crucial for getting JSON output 
      },
    });

    // Extract the text part which should be a JSON string
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return new Response(JSON.stringify({ success: false, message: 'No valid response from AI.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse the JSON string into an object
    // Ensure the parsed object matches the expected rule types (excluding NaturalLanguageRule)
    const suggestedRule: Exclude<Rule, NaturalLanguageRule> = JSON.parse(responseText);

    // Return the structured rule to the frontend
    const apiResponse: GeminiRuleConversionResponse = {
      success: true,
      message: 'Rule successfully generated from natural language.',
      suggestedRule: suggestedRule,
      confidence: 1.0 // Placeholder for AI confidence, can be estimated or returned by model if supported
    };

    return new Response(JSON.stringify(apiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('API Error generating rule:', error);
    return new Response(JSON.stringify({ success: false, message: `Failed to generate rule: ${error.message || 'An unknown error occurred.'}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
