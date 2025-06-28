
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DataRow, DataModificationInstructions, FileCategory, GeminiDataModificationResponse } from '@/types';
import { validateData } from '@/lib/dataProcessor'; 
export async function POST(request: Request) {
  try {
    const { prompt, category, currentData }: { prompt: string; category: FileCategory; currentData: DataRow[] } = await request.json();

    if (!prompt || !category || !currentData) {
      return new Response(JSON.stringify({ success: false, message: 'Missing prompt, category, or currentData.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Received prompt:', prompt);
    console.log('Received category:', category);
    console.log('Received currentData (first 5 rows):', JSON.stringify(currentData.slice(0, 5), null, 2));

    const apiKey = process.env.NEXT_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing NEXT_GEMINI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const headers = currentData.length > 0 ? Object.keys(currentData[0]) : [];
    const columnInfo = headers.map(header => {
      const sampleValues = currentData.map(row => row[header]).filter(val => val !== null && val !== undefined).slice(0, 5);
      let type = 'string';
      if (sampleValues.every(val => typeof val === 'number')) type = 'number';
      else if (sampleValues.every(val => typeof val === 'boolean')) type = 'boolean';
      return `${header} (${type})`;
    }).join(', ');

    const chatHistory = [
      {
        role: "user",
        parts: [
          { text: `
            You are an expert AI assistant tasked with converting natural language data modification requests into a strict JSON format.
            The user will provide a request and the current dataset's category and its available column headers.
            Your output MUST be a JSON object adhering to the provided JSON schema.
            
            Current Data Category: "${category}"
            Available Columns in "${category}" data: ${columnInfo}.
            
            Operations for 'operator' in filters:
            - 'eq': equals (==)
            - 'neq': not equals (!=)
            - 'gt': greater than (>)
            - 'lt': less than (<)
            - 'gte': greater than or equal to (>=)
            - 'lte': less than or equal to (<=)
            - 'contains': string contains substring (case-insensitive)
            - 'not_contains': string does not contain substring (case-insensitive)
            - 'starts_with': string starts with substring (case-insensitive)
            - 'ends_with': string ends with substring (case-insensitive)

            Operations for 'operation' in actions:
            - 'set': Sets the column to the newValue (default if not specified).
            - 'increment': Increases numeric column by newValue.
            - 'decrement': Decreases numeric column by newValue.
            - 'append': Appends newValue (string/array) to existing column value.
            - 'prepend': Prepends newValue (string/array) to existing column value.

            Consider the data types of columns (e.g., don't increment a string column).
            Set 'confirmationRequired' to 'true' if the modification affects many rows, or is potentially irreversible/destructive (e.g., mass status change, deletion, significant value change). Default to 'false' if it's a very targeted or minor change.
            
            ---
            **CRITICAL RULE:** Your JSON output MUST always include 'filters' and 'actions' properties as arrays. If no specific filters or actions are inferred from the prompt, these arrays must be empty. DO NOT omit them under any circumstances.
            ---

            Example 1:
            User Request: "Change the status of client C001 to 'Inactive'."
            Expected JSON:
            {
              "targetCategory": "${category}",
              "filters": [{"column": "clientId", "operator": "eq", "value": "C001"}],
              "actions": [{"column": "status", "newValue": "Inactive", "operation": "set"}],
              "description": "Change status of client C001 to Inactive.",
              "confirmationRequired": false
            }

            Example 2:
            User Request: "For all 'Marketing' tasks, increase their duration by 5."
            Expected JSON:
            {
              "targetCategory": "${category}",
              "filters": [{"column": "category", "operator": "eq", "value": "Marketing"}],
              "actions": [{"column": "duration", "newValue": 5, "operation": "increment"}],
              "description": "Increase duration of all Marketing tasks by 5.",
              "confirmationRequired": true
            }

            Example 3:
            User Request: "Set the email of worker 'John Doe' to 'john.doe@example.com' and their hourly rate to 45.50."
            Expected JSON:
            {
              "targetCategory": "${category}",
              "filters": [{"column": "workerName", "operator": "eq", "value": "John Doe"}],
              "actions": [
                {"column": "email", "newValue": "john.doe@example.com", "operation": "set"},
                {"column": "hourlyRate", "newValue": 45.50, "operation": "set"}
              ],
              "description": "Update email and hourly rate for John Doe.",
              "confirmationRequired": false
            }

            Example 4:
            User Request: "Flag all clients whose name contains 'Ltd' with status 'Review'."
            Expected JSON:
            {
              "targetCategory": "${category}",
              "filters": [{"column": "name", "operator": "contains", "value": "Ltd"}],
              "actions": [{"column": "status", "newValue": "Review", "operation": "set"}],
              "description": "Flag clients with 'Ltd' in name with status 'Review'.",
              "confirmationRequired": true
            }

            Example 5:
            User Request: "Decrease the maxLoadPerPhase by 2 for all workers whose workerGroup is 'Interns'."
            Expected JSON:
            {
              "targetCategory": "${category}",
              "filters": [{"column": "workerGroup", "operator": "eq", "value": "Interns"}],
              "actions": [{"column": "maxLoadPerPhase", "newValue": 2, "operation": "decrement"}],
              "description": "Decrease maxLoadPerPhase for Interns by 2.",
              "confirmationRequired": true
            }

            Example 6:
            User Request: "For tasks that have a duration greater than 60, set their category to 'Long-Running'."
            Expected JSON:
            {
              "targetCategory": "${category}",
              "filters": [{"column": "duration", "operator": "gt", "value": 60}],
              "actions": [{"column": "category", "newValue": "Long-Running", "operation": "set"}],
              "description": "Categorize long-running tasks.",
              "confirmationRequired": true
            }
            
            Example 7:
            User Request: "Make no changes."
            Expected JSON:
            {
              "targetCategory": "${category}",
              "filters": [],
              "actions": [],
              "description": "No changes requested.",
              "confirmationRequired": false
            }

            Now, convert the following user request. Only provide the JSON.
            User Request: "${prompt}"
          `},
        ],
      }
    ];

    const result = await model.generateContent({
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('No valid JSON response from AI for modification instructions.');
    }

    let instructions: DataModificationInstructions;

    try {
      instructions = JSON.parse(responseText);
      // --- Debugging: Log Gemini's output ---
      console.log('Gemini Generated Instructions:', JSON.stringify(instructions, null, 2));
    } catch (err) {
      throw new Error('Failed to parse JSON from AI response: ' + responseText); // Include responseText for better debugging
    }

    // --- Validate structure before processing ---
    if (!Array.isArray(instructions.filters)) {
      throw new Error("Invalid or missing 'filters' in AI-generated instructions. Expected an array.");
    }

    if (!Array.isArray(instructions.actions)) {
      throw new Error("Invalid or missing 'actions' in AI-generated instructions. Expected an array.");
    }

    if (typeof instructions.targetCategory !== 'string') {
      throw new Error("Missing or invalid 'targetCategory'. Expected a string.");
    }

    if (typeof instructions.description !== 'string') {
      throw new Error("Missing or invalid 'description'. Expected a string.");
    }

    if (typeof instructions.confirmationRequired !== 'boolean') {
      throw new Error("Missing or invalid 'confirmationRequired'. Expected a boolean.");
    }

    const updatedData: DataRow[] = JSON.parse(JSON.stringify(currentData));
    let rowsAffected = 0;

    for (let i = 0; i < updatedData.length; i++) {
      const row = updatedData[i];
      let matchesFilters = true;

      for (const filter of instructions.filters) {
        const columnValue = row[filter.column];

        if (columnValue === undefined || columnValue === null) {
          matchesFilters = false;
          break;
        }

        let filterValue: any = filter.value;
        let compareColumnValue: any = columnValue;

        if (typeof compareColumnValue === 'string' && typeof filterValue === 'number' && !isNaN(parseFloat(compareColumnValue))) {
          compareColumnValue = parseFloat(compareColumnValue);
        } 
        else if (typeof compareColumnValue === 'number' && typeof filterValue === 'string' && !isNaN(parseFloat(filterValue))) {
          filterValue = parseFloat(filterValue);
        }
        else if (typeof compareColumnValue === 'string' && typeof filterValue === 'boolean') {
          compareColumnValue = compareColumnValue.toLowerCase() === 'true';
        } 
        else if (typeof compareColumnValue === 'boolean' && typeof filterValue === 'string') {
          filterValue = filterValue.toLowerCase() === 'true';
        }


        switch (filter.operator) {
          case 'eq':
            if (typeof compareColumnValue === 'string' && typeof filterValue === 'string') {
                if (compareColumnValue.toLowerCase() !== filterValue.toLowerCase()) matchesFilters = false;
            } else {
                if (compareColumnValue !== filterValue) matchesFilters = false;
            }
            break;
          case 'neq':
            if (typeof compareColumnValue === 'string' && typeof filterValue === 'string') {
                if (compareColumnValue.toLowerCase() === filterValue.toLowerCase()) matchesFilters = false;
            } else {
                if (compareColumnValue === filterValue) matchesFilters = false;
            }
            break;
          case 'gt':
            if (typeof compareColumnValue !== 'number' || typeof filterValue !== 'number' || !(compareColumnValue > filterValue)) matchesFilters = false;
            break;
          case 'lt':
            if (typeof compareColumnValue !== 'number' || typeof filterValue !== 'number' || !(compareColumnValue < filterValue)) matchesFilters = false;
            break;
          case 'gte':
            if (typeof compareColumnValue !== 'number' || typeof filterValue !== 'number' || !(compareColumnValue >= filterValue)) matchesFilters = false;
            break;
          case 'lte':
            if (typeof compareColumnValue !== 'number' || typeof filterValue !== 'number' || !(compareColumnValue <= filterValue)) matchesFilters = false;
            break;
          case 'contains':
            if (typeof compareColumnValue !== 'string' || typeof filterValue !== 'string' || !compareColumnValue.toLowerCase().includes(filterValue.toLowerCase())) matchesFilters = false;
            break;
          case 'not_contains':
            if (typeof compareColumnValue !== 'string' || typeof filterValue !== 'string' || compareColumnValue.toLowerCase().includes(filterValue.toLowerCase())) matchesFilters = false;
            break;
          case 'starts_with':
            if (typeof compareColumnValue !== 'string' || typeof filterValue !== 'string' || !compareColumnValue.toLowerCase().startsWith(filterValue.toLowerCase())) matchesFilters = false;
            break;
          case 'ends_with':
            if (typeof compareColumnValue !== 'string' || typeof filterValue !== 'string' || !compareColumnValue.toLowerCase().endsWith(filterValue.toLowerCase())) matchesFilters = false;
            break;
          default:
            console.warn(`Unknown filter operator: ${filter.operator}. Skipping this filter.`);
            matchesFilters = false; // If an unknown operator is encountered, the filter should not match
            break;
        }

        if (!matchesFilters) {
          break;
        }
      }

      if (matchesFilters) {
        let rowChanged = false;
        for (const action of instructions.actions) {
          let originalValue = row[action.column];
          let newValue = action.newValue;

          switch (action.operation || 'set') {
            case 'set':
              if (originalValue !== newValue) { 
                row[action.column] = newValue;
                rowChanged = true;
              }
              break;
            case 'increment':
              if (typeof originalValue === 'number' && typeof newValue === 'number') {
                row[action.column] = originalValue + newValue;
                rowChanged = true;
              } else {
                console.warn(`Attempted 'increment' on non-numeric or incompatible types for column '${action.column}'.`);
              }
              break;
            case 'decrement':
              if (typeof originalValue === 'number' && typeof newValue === 'number') {
                row[action.column] = originalValue - newValue;
                rowChanged = true;
              } else {
                console.warn(`Attempted 'decrement' on non-numeric or incompatible types for column '${action.column}'.`);
              }
              break;
            case 'append':
              if (typeof originalValue === 'string' && typeof newValue === 'string') {
                row[action.column] = originalValue + newValue;
                rowChanged = true;
              } else if (Array.isArray(originalValue) && Array.isArray(newValue)) {
                row[action.column] = [...originalValue, ...newValue];
                rowChanged = true;
              } else {
                console.warn(`Attempted 'append' on incompatible types for column '${action.column}'.`);
              }
              break;
            case 'prepend':
              if (typeof originalValue === 'string' && typeof newValue === 'string') {
                row[action.column] = newValue + originalValue;
                rowChanged = true;
              } else if (Array.isArray(originalValue) && Array.isArray(newValue)) {
                row[action.column] = [...newValue, ...originalValue];
                rowChanged = true;
              } else {
                console.warn(`Attempted 'prepend' on incompatible types for column '${action.column}'.`);
              }
              break;
            default:
              console.warn(`Unknown action operation: ${action.operation}. Skipping this action.`);
          }
        }
        if (rowChanged) {
          rowsAffected++;
        }
      }
    }

    const validationErrors = validateData(updatedData, category);

    const apiResponse: GeminiDataModificationResponse = {
      success: true,
      message: `Data modification successful. Affected ${rowsAffected} rows.`,
      fullUpdatedData: {
        headers: headers,
        data: updatedData,
        errors: validationErrors,
      },
      instructions: instructions,
      rowCountAffected: rowsAffected,
    };

    return new Response(JSON.stringify(apiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('API Error during data modification:', error);
    return new Response(JSON.stringify({
      success: false,
      message: `Failed to modify data: ${error.message || 'An unknown error occurred.'}`,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}