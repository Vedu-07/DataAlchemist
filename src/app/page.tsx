'use client';

import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import RuleConfigurator from '@/components/RuleConfigurator';
import DataModifier from '@/components/DataModifier';
import { ParsedData, FileCategory, DataRow } from '@/types';
import { FiSun, FiMoon } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const HomePage: React.FC = () => {
  const [clientsData, setClientsData] = useState<ParsedData | null>(null);
  const [workersData, setWorkersData] = useState<ParsedData | null>(null);
  const [tasksData, setTasksData] = useState<ParsedData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('validation');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDataParsed = useCallback((category: FileCategory, data: ParsedData) => {
    switch (category) {
      case 'clients': setClientsData(data); break;
      case 'workers': setWorkersData(data); break;
      case 'tasks': setTasksData(data); break;
      default: console.error(`Unknown file category: ${category}`);
    }
    toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} data loaded and validated successfully!`);
  }, []);

  const handleFileTypeError = useCallback((errorMessage: string) => {
    toast.error(errorMessage);
  }, []);

  const handleDataUpdate = useCallback((category: FileCategory, updatedData: ParsedData) => {
    switch (category) {
      case 'clients': setClientsData(updatedData); break;
      case 'workers': setWorkersData(updatedData); break;
      case 'tasks': setTasksData(updatedData); break;
      default: console.error(`Unknown data update category: ${category}`);
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
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Successfully exported ${filename}!`);
  };

  const handleExportAllData = useCallback(() => {
    let count = 0;
    if (clientsData?.data.length) { exportToCsv(clientsData.data, 'clients_cleaned.csv'); count++; }
    if (workersData?.data.length) { exportToCsv(workersData.data, 'workers_cleaned.csv'); count++; }
    if (tasksData?.data.length) { exportToCsv(tasksData.data, 'tasks_cleaned.csv'); count++; }
    if (!count) toast.warning("No data available to export. Please upload files first.");
  }, [clientsData, workersData, tasksData]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <header className="text-center mb-14 relative">
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
          Data Alchemist
        </h1>
        <p className="mt-3 text-xl text-muted-foreground max-w-xl mx-auto">
          Forge Your Own AI Resource-Allocation Configurator
        </p>
        <div className="absolute top-0 right-0 mt-4 mr-4">
          {mounted && (
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {resolvedTheme === 'dark' ? <FiSun className="h-6 w-6" /> : <FiMoon className="h-6 w-6" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}
        </div>
      </header>

      <Tabs defaultValue="validation" onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl overflow-hidden border border-border mb-8 shadow-md h-[50px] transition-all">
              <TabsTrigger
                value="validation"
                className="text-base sm:text-lg font-semibold px-6 py-3 h-[40px] flex items-center justify-center
                  data-[state=active]:bg-primary/10
                  data-[state=active]:text-primary
                  data-[state=active]:shadow-inner
                  transition-all duration-300 ease-in-out"
              >
                Data Validation
              </TabsTrigger>
              <TabsTrigger
                value="rules"
                className="text-base sm:text-lg font-semibold px-6 py-3 h-[40px] flex items-center justify-center
                  data-[state=active]:bg-primary/10
                  data-[state=active]:text-primary
                  data-[state=active]:shadow-inner
                  transition-all duration-300 ease-in-out"
              >
                Rule UI
              </TabsTrigger>
            </TabsList>

        <TabsContent value="validation">
          <div className="space-y-14">
            <section>
              <FileUpload onDataParsed={handleDataParsed} onFileTypeError={handleFileTypeError} />
            </section>

            <section>
              <DataModifier
                clientsData={clientsData}
                workersData={workersData}
                tasksData={tasksData}
                onDataUpdated={handleDataUpdate}
              />
            </section>

            <section className="space-y-12">
              {clientsData && (
                <DataTable category="clients" parsedData={clientsData} onDataUpdate={handleDataUpdate} />
              )}
              {workersData && (
                <DataTable category="workers" parsedData={workersData} onDataUpdate={handleDataUpdate} />
              )}
              {tasksData && (
                <DataTable category="tasks" parsedData={tasksData} onDataUpdate={handleDataUpdate} />
              )}
            </section>

            {(clientsData || workersData || tasksData) && (
              <div className="mt-10 text-center">
                <Button onClick={handleExportAllData} size="lg" className="px-8 py-4 text-base font-semibold shadow-sm">
                  Export All Cleaned Data
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rules">
          <RuleConfigurator />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HomePage;
