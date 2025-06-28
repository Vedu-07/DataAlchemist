// src/app/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import RuleConfigurator from '@/components/RuleConfigurator';
import DataModifier from '@/components/DataModifier'; // Import the new DataModifier component
import { ParsedData, FileCategory, DataRow } from '@/types';
import { FiSun, FiMoon } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

const HomePage: React.FC = () => {
  const [clientsData, setClientsData] = useState<ParsedData | null>(null);
  const [workersData, setWorkersData] = useState<ParsedData | null>(null);
  const [tasksData, setTasksData] = useState<ParsedData | null>(null);

  const { theme, setTheme } = useTheme();

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
        console.error(`Unknown file category: ${category}`);
        break;
    }
    toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} data loaded and validated successfully!`);
  }, []);

  const handleFileTypeError = useCallback((errorMessage: string) => {
    toast.error(errorMessage);
  }, []);

  /**
   * Universal handler for updating data for a specific category.
   * This is used by DataTable (for manual cell edits) and now by DataModifier (for NL edits).
   */
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
        console.error(`Unknown data update category: ${category}`);
        break;
    }
  }, []);

  const exportToCsv = (data: DataRow[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error(`No data to export for ${filename}.`);
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
      toast.success(`Successfully exported ${filename}!`);
    } else {
      toast.error(`Your browser does not support automatic CSV download.`);
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
      toast.warning("No data available to export. Please upload files first.");
    }
  }, [clientsData, workersData, tasksData]);

  return (
    <div className="container mx-auto max-w-7xl px-4">
      <header className="text-center mb-12 relative">
        <h1 className="text-5xl font-extrabold text-foreground leading-tight">
          🚀 Data Alchemist
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Forge Your Own AI Resource-Allocation Configurator
        </p>
        <div className="absolute top-0 right-0 mt-4 mr-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <FiSun className="h-6 w-6" />
            ) : (
              <FiMoon className="h-6 w-6" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </header>

      {/* File Upload Section */}
      <section className="mb-12">
        <FileUpload
          onDataParsed={handleDataParsed}
          onFileTypeError={handleFileTypeError}
        />
      </section>

      {/* Natural Language Data Modification Section - NEW */}
      <section className="mb-12">
        <DataModifier
          clientsData={clientsData}
          workersData={workersData}
          tasksData={tasksData}
          onDataUpdated={handleDataUpdate} // Pass the universal data update handler
        />
      </section>

      {/* Rule Configuration Section */}
      <section className="mb-12">
        <RuleConfigurator />
      </section>

      {/* Data Display Sections */}
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

      {/* Export Button */}
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
