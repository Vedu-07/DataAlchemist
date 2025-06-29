import { GoogleGenerativeAI } from '@google/generative-ai';
import { Rule, GeminiRuleConversionResponse, NaturalLanguageRule } from '@/types'; // Import necessary types

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, message: 'Prompt is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.NEXT_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Missing NEXT_GEMINI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 
    const ruleSchemaDefinition = {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["coRun", "slotRestriction", "loadLimit", "phaseWindow", "patternMatch", "precedenceOverride"]
        },
        description: { type: "string" },
        isEnabled: { type: "boolean" },
        taskIds: { type: "array", items: { type: "string" } }, 
        groupType: { type: "string", enum: ["clientGroup", "workerGroup"] }, 
        groupName: { type: "string" },
        minCommonSlots: { type: "number" }, 
        maxLoad: { type: "number" },
        phase: { type: "number" }, 
        taskId: { type: "string" }, 
        allowedPhases: {
          type: "array",
          items: { type: ["number", "string"] },
        }, 
        entity: { type: "string", enum: ["clients", "workers", "tasks"] }, 
        column: { type: "string" },
        regex: { type: "string" }, 
        action: { type: "string", enum: ["flag", "transform"] }, 
        actionDetails: {
          type: "object",
          properties: {
            transformTo: { type: "string" },
            message: { type: "string" }
          },
        }, 
        ruleIds: { type: "array", items: { type: "string" } } 
      },
      required: ["type", "description", "isEnabled"] 
    };

    const chatHistory = [
      {
        role: "user",
        parts: [
          { text: `
            You are an expert in converting natural language business rules into a strict JSON format based on predefined types.
            The available rule types are: 'coRun', 'slotRestriction', 'loadLimit', 'phaseWindow', 'patternMatch', 'precedenceOverride'.
            Your output MUST be a JSON object adhering to the following JSON schema.
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

            JSON Schema for response:
            ${JSON.stringify(ruleSchemaDefinition, null, 2)}
          `}
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
      return new Response(JSON.stringify({ success: false, message: 'No valid response from AI.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const suggestedRule: Exclude<Rule, NaturalLanguageRule> = JSON.parse(responseText);

    const apiResponse: GeminiRuleConversionResponse = {
      success: true,
      message: 'Rule successfully generated from natural language.',
      suggestedRule: suggestedRule,
      confidence: 1.0 
    };

    return new Response(JSON.stringify(apiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) { 
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error('API Error generating rule:', error);
    return new Response(JSON.stringify({ success: false, message: `Failed to generate rule: ${errorMessage}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
