'use client';

import React, { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import { ParsedData, FileCategory, DataRow } from '@/types'; 
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

const HomePage: React.FC = () => {
  const [clientsData, setClientsData] = useState<ParsedData | null>(null);
  const [workersData, setWorkersData] = useState<ParsedData | null>(null);
  const [tasksData, setTasksData] = useState<ParsedData | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | '' }>({ text: '', type: '' }); // <--- ADDED 'warning'

  const handleDataParsed = useCallback((category: FileCategory, data: ParsedData) => {
    switch (category) {
      case 'clients':
        setClientsData(data);
        break;
      case 'workers':
        setWorkersData(data);
        break;
      case 'tasks':
        setTasksData(data);
        break;
      default:
        break;
    }
    setMessage({ text: `${category.charAt(0).toUpperCase() + category.slice(1)} data loaded and validated successfully!`, type: 'success' });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  }, []);

  const handleFileTypeError = useCallback((errorMessage: string) => {
    setMessage({ text: errorMessage, type: 'error' });
    setTimeout(() => setMessage({ text: '', type: '' }), 7000);
  }, []);

  const handleDataUpdate = useCallback((category: FileCategory, updatedData: ParsedData) => {
    switch (category) {
      case 'clients':
        setClientsData(updatedData);
        break;
      case 'workers':
        setWorkersData(updatedData);
        break;
      case 'tasks':
        setTasksData(updatedData);
        break;
      default:
        break;
    }
  }, []);

 
  const exportToCsv = (data: DataRow[], filename: string) => {
    if (!data || data.length === 0) {
      setMessage({ text: `No data to export for ${filename}.`, type: 'error' });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { 
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); 
      setMessage({ text: `Successfully exported ${filename}!`, type: 'success' });
    } else {
      setMessage({ text: `Your browser does not support automatic CSV download.`, type: 'error' });
    }
  };

 
  const handleExportAllData = useCallback(() => {
    let exportedCount = 0;
    if (clientsData && clientsData.data.length > 0) {
      exportToCsv(clientsData.data, 'clients_cleaned.csv');
      exportedCount++;
    }
    if (workersData && workersData.data.length > 0) {
      exportToCsv(workersData.data, 'workers_cleaned.csv');
      exportedCount++;
    }
    if (tasksData && tasksData.data.length > 0) {
      exportToCsv(tasksData.data, 'tasks_cleaned.csv');
      exportedCount++;
    }

    if (exportedCount === 0) {
      setMessage({ text: "No data available to export. Please upload files first.", type: "warning" });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    } else {
        // A success message is set by exportToCsv for each file,
        // so we don't need a global one here unless no files were exported.
    }
  }, [clientsData, workersData, tasksData]);

  return (
    <div className="container mx-auto max-w-7xl px-4">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-foreground leading-tight">
          Data Alchemist
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Forge Your Own AI Resource-Allocation Configurator
        </p>
      </header>

      {message.text && (
        <div
          className={`p-4 mb-6 rounded-lg flex items-center justify-center transition-all duration-300 ease-in-out
                      ${message.type === 'success' ? 'bg-primary/20 border border-primary text-primary-foreground' : message.type === 'warning' ? 'bg-yellow-200 border border-yellow-500 text-yellow-800' : 'bg-destructive/20 border border-destructive text-destructive-foreground'}`} 
          role="alert"
        >
          {message.type === 'success' ? <FiCheckCircle className="mr-2 text-xl" /> : <FiAlertTriangle className="mr-2 text-xl" />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

     
      <section className="mb-12">
        <FileUpload
          onDataParsed={handleDataParsed}
          onFileTypeError={handleFileTypeError}
        />
      </section>

      
      <section className="space-y-12">
        {clientsData && (
          <DataTable
            category="clients"
            parsedData={clientsData}
            onDataUpdate={handleDataUpdate}
          />
        )}
        {workersData && (
          <DataTable
            category="workers"
            parsedData={workersData}
            onDataUpdate={handleDataUpdate}
          />
        )}
        {tasksData && (
          <DataTable
            category="tasks"
            parsedData={tasksData}
            onDataUpdate={handleDataUpdate}
          />
        )}
      </section>

      
      {(clientsData || workersData || tasksData) && (
        <div className="mt-12 text-center">
          <Button
            onClick={handleExportAllData}
            size="lg"
          >
            Export All Cleaned Data
          </Button>
        </div>
      )}
    </div>
  );
};

export default HomePage;