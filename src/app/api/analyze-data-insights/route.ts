import { GoogleGenerativeAI } from '@google/generative-ai';
import { DataRow, FileCategory, ValidationError, AIInsightResponse } from '@/types';

export async function POST(request: Request) {
  try {
    const { category, data, existingErrors }: { category: FileCategory; data: DataRow[]; existingErrors: ValidationError[] } = await request.json();

    if (!category || !data || !Array.isArray(existingErrors)) {
      return new Response(JSON.stringify({ success: false, message: 'Missing category, data, or existingErrors array.' }), {
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

    const sampleData = data.slice(0, Math.min(data.length, 20)); 
    const dataSampleForPrompt = JSON.stringify(sampleData, null, 2);

    const existingErrorsForPrompt = existingErrors.length > 0
      ? `\n\nExisting validation errors already identified by static rules (consider these, and suggest corrections where possible):\n${JSON.stringify(existingErrors, null, 2)}`
      : '\n\nThere are no existing static validation errors for the AI to directly address, but still look for anomalies.';

    const responseSchemaDefinition = {
      type: "object",
      properties: {
        aiIdentifiedIssues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              row: { type: "number", description: "0-indexed row number where the issue is found." },
              column: { type: "string", description: "Column name where the issue is located." },
              message: { type: "string", description: "Clear, user-friendly description of the error or anomaly." },
              severity: { type: "string", enum: ["warning", "error"], description: "Severity of the issue: 'error' for strict violations, 'warning' for anomalies/outliers." },
              isAIIdentified: { type: "boolean", description: "Always true for issues identified by this AI." },
              isAnomaly: { type: "boolean", description: "True if this is an anomaly (e.g., an outlier) rather than a strict validation error." },
              aiConfidence: { type: "number", description: "AI's confidence score (0-1) for this finding/suggestion." },
              suggestedCorrection: {
                type: "object",
                properties: {
                  column: { type: "string", description: "The column key for the suggested correction." },
                  newValue: { type: ["string", "number", "boolean", "null"], description: "The suggested new value for the correction." },
                  reason: { type: "string", description: "A brief reason for the suggested correction." }
                },
                required: ["column", "newValue"]
              }
            },
            required: ["row", "column", "message", "severity", "isAIIdentified"]
          },
          default: []
        },
        summaryInsights: {
          type: "array",
          items: { type: "string" },
          description: "High-level summary points about data quality or interesting patterns observed.",
          default: []
        },
        aiMessage: { type: "string", description: "A concise, overall summary message from the AI." }
      },
      required: ["aiIdentifiedIssues", "summaryInsights", "aiMessage"]
    };

    const chatHistory = [
      {
        role: "user",
        parts: [
          { text: `
            You are an expert Data Quality Analyst and Alchemist. Your goal is to help a non-technical user improve their data.
            You will analyze a sample of their '${category}' dataset and a list of any existing static validation errors.

            Your task is to:
            1.  **Identify Anomalies/Outliers:** Look for values that are statistically unusual or seem out of place compared to other data in the same column or across similar rows. Mark these with "severity": "warning" and "isAnomaly": true.
            2.  **Suggest Corrections for Errors/Anomalies:** For any issue you identify (or for existing static errors), if you can infer a logical fix, provide a "suggestedCorrection" with a "newValue" and a brief "reason". Ensure "suggestedCorrection.column" matches the "column" of the issue.
            3.  **Generate User-Friendly Messages:** Provide clear, non-technical "message" for each issue, explaining *why* it's an issue and *what* it implies.
            4.  **Provide High-Level Summary Insights:** Offer a few concise bullet points ("summaryInsights") about overall data quality, common issues, or interesting patterns.
            5.  **Output JSON:** Your response MUST strictly adhere to the following JSON schema. Ensure "aiIdentifiedIssues" and "summaryInsights" are always arrays, even if empty.

            Current Data Category: '${category}'

            Sample Data (up to 20 rows):
            ${dataSampleForPrompt}

            ${existingErrorsForPrompt}

            JSON Schema for response:
            ${JSON.stringify(responseSchemaDefinition, null, 2)}

            Focus on providing actionable insights and easy fixes for a non-technical user.
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
      throw new Error('No valid JSON response from AI for data insights.');
    }

    let aiResponse: AIInsightResponse;
    try {
      aiResponse = JSON.parse(responseText);
      aiResponse.aiIdentifiedIssues = Array.isArray(aiResponse.aiIdentifiedIssues) ? aiResponse.aiIdentifiedIssues : [];
      aiResponse.summaryInsights = Array.isArray(aiResponse.summaryInsights) ? aiResponse.summaryInsights : [];

      console.log('Gemini AI Data Insights Response:', JSON.stringify(aiResponse, null, 2));

    } catch (err: unknown) { 
      let errorMessage = 'Failed to parse JSON from AI for insights.';
      if (err instanceof Error) {
        errorMessage += ` Error: ${err.message}`;
      }
      console.error("JSON parse error from AI for insights:", err);
      console.error("Raw AI response leading to parse error:", responseText);
      throw new Error(`${errorMessage}. Raw response: ${responseText}`);
    }

    const apiResponse: AIInsightResponse = {
      success: true,
      aiMessage: aiResponse.aiMessage || 'AI analysis complete.',
      aiIdentifiedIssues: aiResponse.aiIdentifiedIssues,
      summaryInsights: aiResponse.summaryInsights,
    };

    return new Response(JSON.stringify(apiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) { 
    let errorMessage = 'An unknown error occurred during AI data insights.';
    if (error instanceof Error) {
      errorMessage = `Failed AI insights: ${error.message}`;
    }
    console.error('API Error during AI data insights:', error);
    return new Response(JSON.stringify({
      success: false,
      message: errorMessage,
      error: error instanceof Error ? error.message : String(error),
      aiIdentifiedIssues: [],
      summaryInsights: [],
      aiMessage: 'An error occurred during AI data analysis.' 
    } as AIInsightResponse), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
