import * as XLSX from 'xlsx';
import { DataRow, ParsedData, ValidationError, FileCategory } from '../types';


const toCamelCase = (str: string): string => {
  if (!str) return '';

  
  let formattedStr = str.replace(/([a-z0-9])([A-Z])/g, '$1 $2'); 
  formattedStr = formattedStr.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2'); 

  const parts = formattedStr
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/);

  if (parts.length === 0) {
    return '';
  }


  const firstPart = parts[0].toLowerCase();

  const restParts = parts.slice(1).map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  return firstPart + restParts.join('');
};


export const parseFile = async (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file data."));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0]; 
        const worksheet = workbook.Sheets[sheetName];

        
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

        if (jsonData.length === 0) {
          resolve({ headers: [], data: [], errors: [{ row: 0, column: 'File', message: 'The uploaded file is empty.', severity: 'warning' }] });
          return;
        }

        
        const rawHeaders: string[] = jsonData[0] as string[];
        
        const headers: string[] = rawHeaders.map(header => toCamelCase(header));


        const rows: any[][] = jsonData.slice(1);

        const parsedRows: DataRow[] = rows.map((rowArr, rowIndex) => {
          const rowObject: DataRow = {};
          headers.forEach((cleanedHeader, colIndex) => {
  
            rowObject[cleanedHeader] = rowArr[colIndex];
          });
          return rowObject;
        });


        resolve({ headers, data: parsedRows, errors: [] });

      } catch (error: any) {
        console.error("Error parsing file:", error);
        reject(new Error(`Failed to parse file: ${error.message}`));
      }
    };

    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(new Error("Error reading file."));
    };

    reader.readAsBinaryString(file);
  });
};


export const validateData = (data: DataRow[], category: FileCategory): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!data || data.length === 0) {
    errors.push({ row: 0, column: 'N/A', message: 'No data to validate.', severity: 'warning' });
    return errors;
  }


  const isEmpty = (value: any): boolean => {
    return value === null || value === undefined || String(value).trim() === '';
  };


  const encounteredIds = new Set<string>(); 
  const idColumnMap: { [key: string]: string } = {
    clients: 'clientId',
    workers: 'workerId',
    tasks: 'taskId'
  };
  const idColumn = idColumnMap[category];

  data.forEach((row, rowIndex) => {
    Object.keys(row).forEach(key => {
      if (isEmpty(row[key])) {
        errors.push({
          row: rowIndex + 1,
          column: key,
          message: `Empty value found in column '${key}'.`,
          severity: 'warning'
        });
      }
    });

    if (idColumn && row[idColumn]) {
      const idValue = String(row[idColumn]).trim();
      if (idValue && encounteredIds.has(idValue)) {
        errors.push({
          row: rowIndex + 1,
          column: idColumn,
          message: `Duplicate ID found: '${idValue}'. IDs must be unique.`,
          severity: 'error'
        });
      }
      encounteredIds.add(idValue);
    }
  });


  switch (category) {
    case 'clients':
      data.forEach((row, rowIndex) => {

        if (isEmpty(row.clientId)) {
          errors.push({
            row: rowIndex + 1,
            column: 'clientId',
            message: "Missing or empty 'clientId'. This is a critical identifier.",
            severity: 'error'
          });
        }

        if (row.email && !isEmpty(row.email)) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(row.email).trim())) {
            errors.push({
              row: rowIndex + 1,
              column: 'email',
              message: `'${row.email}' is not a valid email format.`,
              severity: 'warning'
            });
          }
        }

        const validStatuses = ['active', 'inactive', 'pending', 'vip'];
        if (row.status && !isEmpty(row.status)) {
            const lowerCaseStatus = String(row.status).toLowerCase();
            if (!validStatuses.includes(lowerCaseStatus)) {
                errors.push({
                    row: rowIndex + 1,
                    column: 'status',
                    message: `'${row.status}' is not a valid status. Expected: ${validStatuses.join(', ')} (case-insensitive).`,
                    severity: 'warning'
                });
            }
        }
      });
      break;

    case 'workers':
      data.forEach((row, rowIndex) => {
 
        if (isEmpty(row.workerId)) {
          errors.push({
            row: rowIndex + 1,
            column: 'workerId',
            message: "Missing or empty 'workerId'. This is a critical identifier.",
            severity: 'error'
          });
        }
        const workerSkills = String(row.skills || '').trim(); 


        if (isEmpty(workerSkills)) {
          errors.push({
            row: rowIndex + 1,
            column: 'skills', 
            message: "'skills' should be a non-empty string.",
            severity: 'warning'
          });
        }

        if (row.hourlyRate !== undefined && !isEmpty(row.hourlyRate)) {
            const rate = Number(row.hourlyRate);
            if (isNaN(rate) || rate <= 0) {
                errors.push({
                    row: rowIndex + 1,
                    column: 'hourlyRate',
                    message: "'hourlyRate' must be a positive number.",
                    severity: 'warning'
                });
            }
        }
      });
      break;

    case 'tasks':
      data.forEach((row, rowIndex) => {
   
        if (isEmpty(row.taskId)) {
          errors.push({
            row: rowIndex + 1,
            column: 'taskId',
            message: "Missing or empty 'taskId'. This is a critical identifier.",
            severity: 'error'
          });
        }
        
        const validPriorities = ['high', 'medium', 'low', 'urgent'];
        if (row.priority && !isEmpty(row.priority)) {
          const lowerCasePriority = String(row.priority).toLowerCase();
          if (!validPriorities.includes(lowerCasePriority)) {
            errors.push({
              row: rowIndex + 1,
              column: 'priority',
              message: `'${row.priority}' is not a valid priority. Expected: ${validPriorities.join(', ')} (case-insensitive).`,
              severity: 'warning'
            });
          }
        }
        
        if (row.dueDate && !isEmpty(row.dueDate)) {
            try {
                const date = new Date(row.dueDate);
                if (isNaN(date.getTime())) { 
                    errors.push({
                        row: rowIndex + 1,
                        column: 'dueDate',
                        message: `'${row.dueDate}' is not a valid date format.`,
                        severity: 'warning'
                    });
                }
            } catch (e) {
                errors.push({
                    row: rowIndex + 1,
                    column: 'dueDate',
                    message: `'${row.dueDate}' is not a valid date format.`,
                    severity: 'warning'
                });
            }
        }
      });
      break;
  }

  return errors;
};
