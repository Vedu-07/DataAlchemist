'use client';

import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import DataModifier from '@/components/DataModifier';
import {
  ParsedData, FileCategory, DataRow, ValidationError, AIInsightResponse, AIValidationIssue,
  AllocationAnalysisResponse,
  Rule
} from '@/types';
import { FiSun, FiMoon, FiZap, FiLoader } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator'; 
import RuleConfigurator from '@/components/RuleConfigurator';

const HomePage: React.FC = () => {
  const [clientsData, setClientsData] = useState<ParsedData | null>(null);
  const [workersData, setWorkersData] = useState<ParsedData | null>(null);
  const [tasksData, setTasksData] = useState<ParsedData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('validation');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [globalRules, setGlobalRules] = useState<Rule[]>([]);

  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsSummary, setAiInsightsSummary] = useState<string[]>([]);
  const [overallAiMessage, setOverallAiMessage] = useState('');

  const [allocationAnalysisLoading, setAllocationAnalysisLoading] = useState(false);
  const [allocationAnalysisResult, setAllocationAnalysisResult] = useState<AllocationAnalysisResponse | null>(null);

  const handleRulesChange = useCallback((updatedRules: Rule[]) => {
    setGlobalRules(updatedRules);
    console.log("Rules updated from RuleConfigurator:", updatedRules);
  }, []); 


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
    setAllocationAnalysisResult(null); 
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
    setAllocationAnalysisResult(null); 
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
    setAllocationAnalysisResult(null); 

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

  const handleAnalyzeAllocation = useCallback(async () => {
    if (!clientsData || !workersData || !tasksData) {
      toast.warning("Please upload Client, Worker, and Task data before running allocation analysis.");
      return;
    }

    setAllocationAnalysisLoading(true);
    setAllocationAnalysisResult(null); 
    toast.info("Running AI-powered allocation feasibility analysis...");

    try {
      const response = await fetch('/api/analyze-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientsData: clientsData.data,
          workersData: workersData.data,
          tasksData: tasksData.data,
          rules: [], 
        }),
      });

      const result: AllocationAnalysisResponse = await response.json();

      if (response.ok && result.success) {
        setAllocationAnalysisResult(result);
        toast.success("AI Allocation Analysis complete!");
      } else {
        toast.error(`Allocation analysis failed: ${result.message || 'Unknown error.'}`);
        setAllocationAnalysisResult({
          success: false,
          message: result.message || 'Failed to analyze allocation.',
          overallStatus: 'unknown',
          bottlenecks: [],
          predictedRuleViolations: [],
          predictedUnassignedTasksCount: 0,
          recommendations: [],
          error: result.error || 'API error',
        });
      }
    } catch (error: any) {
      console.error('API Error during allocation analysis:', error);
      toast.error(`An unexpected error occurred during analysis: ${error.message || 'Please try again.'}`);
      setAllocationAnalysisResult({
        success: false,
        message: `An unexpected error occurred: ${error.message || 'Please try again.'}`,
        overallStatus: 'unknown',
        bottlenecks: [],
        predictedRuleViolations: [],
        predictedUnassignedTasksCount: 0,
        recommendations: [],
      });
    } finally {
      setAllocationAnalysisLoading(false);
    }
  }, [clientsData, workersData, tasksData]); 


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
        <p className="mt-3 text-xl text-muted-foreground max-w-xl mx-auto">Transform Data into Optimized Resources</p>
        <div className="absolute top-0 right-0 mt-4 mr-4">
          {mounted && (
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className='cursor-pointer'>
              {resolvedTheme === 'dark' ? <FiSun className="h-6 w-6" /> : <FiMoon className="h-6 w-6" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}
        </div>
      </header>

      <Tabs defaultValue="validation" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl overflow-hidden border border-border mb-8 shadow-md h-[50px] transition-all">
          <TabsTrigger value="validation" className=" cursor-pointer text-base sm:text-lg font-semibold px-6 py-3 h-[40px] flex items-center justify-center data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-inner transition-all duration-300 ease-in-out">
            Data Validation
          </TabsTrigger>
          
          <TabsTrigger value="allocation" className=" cursor-pointer text-base sm:text-lg font-semibold px-6 py-3 h-[40px] flex items-center justify-center data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-inner transition-all duration-300 ease-in-out">
            Allocation Analysis
          </TabsTrigger>

          <TabsTrigger value="rules" className="cursor-pointer text-base sm:text-lg font-semibold px-6 py-3 h-[40px] flex items-center justify-center data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-inner transition-all duration-300 ease-in-out">
            Rule UI (Beta)
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
                    <Button className='cursor-pointer' onClick={handleRunSmartInsights} disabled={aiInsightsLoading || (!clientsData && !workersData && !tasksData)}>
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
                <Button onClick={handleExportAllData} size="lg" className="px-8 py-4 text-base font-semibold shadow-sm cursor-pointer">
                  Export All Cleaned Data
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="allocation">
          <Card className="p-6 md:p-8">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-foreground">AI-Powered Allocation Feasibility & Bottleneck Analysis</CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Let the AI analyze your loaded data to determine allocation feasibility and identify roadblocks. No explicit rules are currently being considered for this analysis.
                Upload all the 3 files for allocation feasibility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <Button
                  className='cursor-pointer'
                  onClick={handleAnalyzeAllocation}
                  disabled={allocationAnalysisLoading || (!clientsData || !workersData || !tasksData)}
                >
                  {allocationAnalysisLoading ? (
                    <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FiZap className="mr-2 h-4 w-4" />
                  )}
                  Analyze Allocation Feasibility
                </Button>
              </div>

              {allocationAnalysisResult && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-center mt-4">Analysis Results:</h3>
                  <p className="text-center text-lg font-medium">Overall Status:
                    <span className={`ml-2 px-3 py-1 rounded-full text-white ${
                      allocationAnalysisResult.overallStatus === 'feasible' ? 'bg-green-500' :
                      allocationAnalysisResult.overallStatus === 'challenged' ? 'bg-yellow-500' :
                      allocationAnalysisResult.overallStatus === 'highly_challenged' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`}>
                      {allocationAnalysisResult.overallStatus?.replace(/_/g, ' ').toUpperCase() ?? 'UNKNOWN'}
                    </span>
                  </p>
                  {allocationAnalysisResult.message && (
                    <p className="text-center text-muted-foreground italic text-sm">{allocationAnalysisResult.message}</p>
                  )}

                  <Separator className="my-4" />

                  {allocationAnalysisResult.bottlenecks.length > 0 && (
                    <div className="border rounded-lg p-4 bg-red-100 dark:bg-red-900/20">
                      <h4 className="font-semibold text-lg mb-2 text-red-700 dark:text-red-300">Identified Bottlenecks ({allocationAnalysisResult.bottlenecks.length}):</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-200">
                        {allocationAnalysisResult.bottlenecks.map((b, index) => (
                          <li key={index}>
                            <strong>{b.type?.replace(/_/g, ' ') ?? 'N/A'}:</strong> {b.message || 'No specific message provided.'}
                            {b.details && <span className="ml-1 text-xs italic">({b.details})</span>}
                            {b.relatedIds && b.relatedIds.length > 0 && <span className="ml-1 text-xs text-muted-foreground">(Related IDs: {b.relatedIds.join(', ')})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {allocationAnalysisResult.predictedRuleViolations.length > 0 && (
                    <div className="border rounded-lg p-4 bg-orange-100 dark:bg-orange-900/20">
                      <h4 className="font-semibold text-lg mb-2 text-orange-700 dark:text-orange-300">Predicted Rule Violations ({allocationAnalysisResult.predictedRuleViolations.length}):</h4>
                      <p className="text-muted-foreground text-xs mb-2">These are potential implicit violations identified from data patterns, as no explicit rules are configured.</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-orange-800 dark:text-orange-200">
                        {allocationAnalysisResult.predictedRuleViolations.map((rv, index) => (
                          <li key={index}>{rv}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {allocationAnalysisResult.predictedUnassignedTasksCount > 0 && (
                    <div className="border rounded-lg p-4 bg-blue-100 dark:bg-blue-900/20">
                      <h4 className="font-semibold text-lg mb-2 text-blue-700 dark:text-blue-300">Estimated Unassigned Tasks:</h4>
                      <p className="text-blue-800 dark:text-blue-200 text-sm">
                        Approximately <strong>{allocationAnalysisResult.predictedUnassignedTasksCount}</strong> tasks might remain unassigned given current constraints.
                      </p>
                    </div>
                  )}

                  {allocationAnalysisResult.recommendations.length > 0 && (
                    <div className="border rounded-lg p-4 bg-green-100 dark:bg-green-900/20">
                      <h4 className="font-semibold text-lg mb-2 text-green-700 dark:text-green-300">Recommendations ({allocationAnalysisResult.recommendations.length}):</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-green-800 dark:text-green-200">
                        {allocationAnalysisResult.recommendations.map((r, index) => (
                          <li key={index}>
                            <strong>{r.type?.replace(/_/g, ' ') ?? 'N/A'}:</strong> {r.message || 'No specific message provided.'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <RuleConfigurator onRulesUpdate={handleRulesChange}/>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HomePage;