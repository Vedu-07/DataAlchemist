'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DataRow, ParsedData, ValidationError, FileCategory } from '@/types';
import { validateData } from '@/lib/dataProcessor';
import { FiAlertCircle } from 'react-icons/fi'; 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; 


interface DataTableProps {
  category: FileCategory;
  parsedData: ParsedData;
  onDataUpdate: (category: FileCategory, updatedData: ParsedData) => void;
}

const DataTable: React.FC<DataTableProps> = ({ category, parsedData, onDataUpdate }) => {
  const [tableData, setTableData] = useState<DataRow[]>(parsedData.data);
  const [currentErrors, setCurrentErrors] = useState<ValidationError[]>(parsedData.errors);

  useEffect(() => {
    
    setTableData(parsedData.data);
    setCurrentErrors(parsedData.errors);
  }, [parsedData, category]);

  const getCellErrors = useCallback((rowIndex: number, column: string): ValidationError[] => {
    return currentErrors.filter(
      (error) => error.row === rowIndex + 1 && error.column === column
    );
  }, [currentErrors]);

  const handleCellChange = useCallback((
    rowIndex: number,
    columnKey: string,
    newValue: string
  ) => {
    const updatedData = [...tableData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      [columnKey]: newValue,
    };
    setTableData(updatedData);

    const reValidationErrors = validateData(updatedData, category);
    setCurrentErrors(reValidationErrors);

    onDataUpdate(category, {
      headers: parsedData.headers,
      data: updatedData,
      errors: reValidationErrors,
    });
  }, [tableData, category, parsedData.headers, onDataUpdate]);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="capitalize text-2xl text-foreground">{category} Data</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {currentErrors.length > 0 && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive text-destructive-foreground rounded-lg">
            <h3 className="font-semibold text-lg flex items-center mb-2">
              <FiAlertCircle className="mr-2 text-xl" /> Validation Issues Found:
            </h3>
            <ul className="list-disc list-inside text-sm max-h-40 overflow-y-auto">
              {currentErrors.map((error, index) => (
                <li key={index}>
                  Row {error.row}, Column '{error.column}': {error.message}
                  {error.severity === 'error' && <span className="text-destructive-foreground/80 ml-2">(Critical)</span>}
                  {error.severity === 'warning' && <span className="text-orange-400 ml-2">(Warning)</span>} {/* Custom for warning, can define in globals.css */}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-destructive-foreground/90">Please review and correct the highlighted cells.</p>
          </div>
        )}

        {tableData.length === 0 && currentErrors.length === 0 ? (
          <div className="text-center p-10 text-muted-foreground">
            <p>No data available. Please upload a file to get started.</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto border border-border rounded-lg">
            <Table className="min-w-full divide-y divide-border">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  {parsedData.headers.map((header, index) => (
                    <TableHead
                      key={index}
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {parsedData.headers.map((header, colIndex) => {
                      const cellValue = row[header];
                      const errorsInCell = getCellErrors(rowIndex, header);
                      const hasErrors = errorsInCell.length > 0;

                      return (
                        <TableCell
                          key={colIndex}
                          className={`px-6 py-4 whitespace-nowrap text-sm text-foreground relative
                                    ${hasErrors ? 'bg-destructive/5 border border-destructive rounded-md shadow-sm' : ''}`}
                        >
                          <div
                            contentEditable
                            suppressContentEditableWarning={true}
                            onBlur={(e) => handleCellChange(rowIndex, header, e.target.innerText)}
                            className={`min-w-[80px] p-1 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent rounded-md ${hasErrors ? 'text-destructive-foreground font-semibold' : ''}`}
                          >
                            {cellValue === null || cellValue === undefined ? '' : String(cellValue)}
                          </div>
                          {hasErrors && (
                            <div className="absolute top-0 right-0 mt-1 mr-1">
                              <FiAlertCircle
                                className="text-destructive text-lg cursor-help"
                                title={errorsInCell.map(e => e.message).join('\n')}
                              />
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataTable;