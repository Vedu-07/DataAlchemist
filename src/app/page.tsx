'use client';

import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import RuleConfigurator from '@/components/RuleConfigurator';
import DataModifier from '@/components/DataModifier';
import {
  ParsedData, FileCategory, DataRow, ValidationError, AIInsightResponse, AIValidationIssue
} from '@/types';
import { FiSun, FiMoon, FiZap, FiLoader } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const HomePage: React.FC = () => {
  const [clientsData, setClientsData] = useState<ParsedData | null>(null);
  const [workersData, setWorkersData] = useState<ParsedData | null>(null);
  const [tasksData, setTasksData] = useState<ParsedData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('validation');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsSummary, setAiInsightsSummary] = useState<string[]>([]);
  const [overallAiMessage, setOverallAiMessage] = useState('');

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
    setAiInsightsSummary([]);
    setOverallAiMessage('');
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
    setAiInsightsSummary([]);
    setOverallAiMessage('Data has been updated. Run AI Insights again for fresh analysis.');
  }, []);

  const combineErrors = useCallback((staticErrors: ValidationError[], aiIssues: AIValidationIssue[]): ValidationError[] => {
    const combined: ValidationError[] = [...staticErrors];

    aiIssues.forEach(aiIssue => {
      const isDuplicate = staticErrors.some(
        se => se.row === aiIssue.row && se.column.toLowerCase() === aiIssue.column.toLowerCase() && se.message === aiIssue.message
      );

      if (!isDuplicate) {
        combined.push(aiIssue);
      } else {
        const existingError = combined.find(
          se => se.row === aiIssue.row && se.column.toLowerCase() === aiIssue.column.toLowerCase() && se.message === aiIssue.message
        );
        if (existingError && aiIssue.suggestedCorrection && !existingError.suggestedCorrection) {
          existingError.suggestedCorrection = aiIssue.suggestedCorrection;
          existingError.isAIIdentified = true;
          existingError.aiConfidence = aiIssue.aiConfidence;
        }
      }
    });

    return combined;
  }, []);

  const handleRunSmartInsights = useCallback(async () => {
    setAiInsightsLoading(true);
    setAiInsightsSummary([]);
    setOverallAiMessage('Analyzing data...');

    try {
      const categoriesToAnalyze = [];
      if (clientsData) categoriesToAnalyze.push({ category: 'clients', data: clientsData.data, errors: clientsData.errors });
      if (workersData) categoriesToAnalyze.push({ category: 'workers', data: workersData.data, errors: workersData.errors });
      if (tasksData) categoriesToAnalyze.push({ category: 'tasks', data: tasksData.data, errors: tasksData.errors });

      if (!categoriesToAnalyze.length) {
        toast.info("No data uploaded yet to run AI Insights.");
        setAiInsightsLoading(false);
        setOverallAiMessage('Upload data to get smart insights.');
        return;
      }

      const allInsights: string[] = [];
      let successfulAnalyses = 0;

      for (const item of categoriesToAnalyze) {

        const category = item.category as FileCategory;
        const data = item.data;
        const errors = item.errors;

        const response = await fetch('/api/analyze-data-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, data, existingErrors: errors }),
        });

        const result: AIInsightResponse = await response.json();

        if (response.ok && result.success) {
          allInsights.push(`--- ${category.toUpperCase()} Data Insights ---`);
          allInsights.push(result.aiMessage);
          allInsights.push(...result.summaryInsights.map(s => `- ${s}`));

          const currentParsedData = (category === 'clients' ? clientsData : category === 'workers' ? workersData : tasksData) as ParsedData;
          if (currentParsedData) {
            const combined = combineErrors(currentParsedData.errors, result.aiIdentifiedIssues);
            handleDataUpdate(category, { ...currentParsedData, errors: combined });
          }

          successfulAnalyses++;
        } else {
          allInsights.push(`--- ${category.toUpperCase()} Data Insights (Failed) ---`);
          allInsights.push(`Error: ${result.aiMessage || 'Unknown error.'}`);
          toast.error(`Failed to get AI insights for ${category}.`);
        }
      }

      setAiInsightsSummary(allInsights);
      setOverallAiMessage(`AI analysis complete for ${successfulAnalyses} categories.`);
      toast.success("AI Smart Insights generated successfully!");
    } catch (error: any) {
      console.error('AI analysis error:', error);
      setOverallAiMessage(`Unexpected error during AI analysis: ${error.message || 'Try again.'}`);
      toast.error(`AI insights error: ${error.message || 'Try again.'}`);
    } finally {
      setAiInsightsLoading(false);
    }
  }, [clientsData, workersData, tasksData, combineErrors, handleDataUpdate]);

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
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground">Data Alchemist</h1>
        <p className="mt-3 text-xl text-muted-foreground max-w-xl mx-auto">Forge Your Own AI Resource-Allocation Configurator</p>
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
          <TabsTrigger value="validation" className="text-base sm:text-lg font-semibold px-6 py-3 h-[40px] flex items-center justify-center data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-inner transition-all duration-300 ease-in-out">
            Data Validation
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-base sm:text-lg font-semibold px-6 py-3 h-[40px] flex items-center justify-center data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-inner transition-all duration-300 ease-in-out">
            Rule UI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="validation">
          <div className="space-y-14">
            <section>
              <FileUpload onDataParsed={handleDataParsed} onFileTypeError={handleFileTypeError} />
            </section>

            <section>
              <Card className="p-6 md:p-8">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold text-foreground">Smart Insights & Anomaly Detection</CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">
                    Let the AI analyze your data for hidden patterns, anomalies, and suggestions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <Button onClick={handleRunSmartInsights} disabled={aiInsightsLoading || (!clientsData && !workersData && !tasksData)}>
                      {aiInsightsLoading ? (
                        <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FiZap className="mr-2 h-4 w-4" />
                      )}
                      Run Smart Insights
                    </Button>
                  </div>
                  {overallAiMessage && <p className="text-center text-sm text-muted-foreground">{overallAiMessage}</p>}
                  {aiInsightsSummary.length > 0 && (
                    <div className="border rounded-lg p-4 bg-secondary/20">
                      <h4 className="font-semibold text-lg mb-2">AI Summary:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                        {aiInsightsSummary.map((insight, index) => (
                          <li key={index}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <DataModifier clientsData={clientsData} workersData={workersData} tasksData={tasksData} onDataUpdated={handleDataUpdate} />
            </section>

            <section className="space-y-12">
              {clientsData && <DataTable category="clients" parsedData={clientsData} onDataUpdate={handleDataUpdate} />}
              {workersData && <DataTable category="workers" parsedData={workersData} onDataUpdate={handleDataUpdate} />}
              {tasksData && <DataTable category="tasks" parsedData={tasksData} onDataUpdate={handleDataUpdate} />}
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
