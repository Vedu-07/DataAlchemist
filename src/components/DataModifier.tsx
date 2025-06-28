'use client';

import React, { useState, useCallback } from 'react';
import { DataRow, ParsedData, FileCategory, GeminiDataModificationResponse, DataFilter, DataModificationAction } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiCpu, FiLoader, FiCheckCircle, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { toast } from 'sonner'; // Sonner toast

interface DataModifierProps {
  clientsData: ParsedData | null;
  workersData: ParsedData | null;
  tasksData: ParsedData | null;
  onDataUpdated: (category: FileCategory, updatedData: ParsedData) => void;
}

const DataModifier: React.FC<DataModifierProps> = ({ clientsData, workersData, tasksData, onDataUpdated }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | ''>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState<boolean>(false);
  const [proposedInstructions, setProposedInstructions] = useState<any>(null); // Store AI's proposed instructions


  const handleModifyData = useCallback(async (confirm: boolean = false) => {
    if (!prompt.trim()) {
      toast.error("Please enter a natural language command for data modification.");
      return;
    }
    if (!selectedCategory) {
      toast.error("Please select a data category to modify.");
      return;
    }

    const currentDataForCategory = (() => {
      switch (selectedCategory) {
        case 'clients': return clientsData;
        case 'workers': return workersData;
        case 'tasks': return tasksData;
        default: return null;
      }
    })();

    if (!currentDataForCategory || currentDataForCategory.data.length === 0) {
      toast.error(`No ${selectedCategory} data available to modify. Please upload a file first.`);
      return;
    }

    setIsLoading(true);
    setConfirmationNeeded(false); 
    setProposedInstructions(null); 

    try {
      const response = await fetch('/api/modify-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          category: selectedCategory,
          currentData: currentDataForCategory.data,
          confirm: confirm 
        }),
      });

      const result: GeminiDataModificationResponse = await response.json();

      if (response.ok && result.success && result.fullUpdatedData && result.instructions) {
        if (result.instructions.confirmationRequired && !confirm) {
          setConfirmationNeeded(true);
          setProposedInstructions(result.instructions);
          toast.info(
            "AI requires confirmation for this modification. Review the proposed changes below.",
            {
              duration: 8000,
              icon: <FiAlertTriangle className="h-4 w-4" />
            }
          );
        } else {
          onDataUpdated(selectedCategory, result.fullUpdatedData);
          setPrompt(''); 
          setProposedInstructions(null);
          setConfirmationNeeded(false);
          toast.success(`Data modified successfully! Affected ${result.rowCountAffected || 0} rows.`);
        }
      } else {
        toast.error(`Data modification failed: ${result.message || 'An unknown error occurred.'}`);
      }
    } catch (error: any) {
      console.error('Error calling modify-data API:', error);
      toast.error(`An unexpected error occurred during modification: ${error.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedCategory, clientsData, workersData, tasksData, onDataUpdated]);

  const handleConfirmModification = useCallback(() => {
    handleModifyData(true); 
  }, [handleModifyData]);

  const handleCancelConfirmation = useCallback(() => {
    setConfirmationNeeded(false);
    setProposedInstructions(null);
    toast.info("Data modification cancelled.");
  }, []);


  return (
    <Card className="mt-8 p-6 md:p-8">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold text-foreground">Natural Language Data Modification</CardTitle>
        <CardDescription className="text-muted-foreground mt-2">
          Tell AI what changes to make to your data in plain English.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="dataCategory">Select Data Category</Label>
          <Select value={selectedCategory} onValueChange={(value: FileCategory) => setSelectedCategory(value)} disabled={isLoading}>
            <SelectTrigger id="dataCategory">
              <SelectValue placeholder="Choose data to modify" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clients">Clients Data</SelectItem>
              <SelectItem value="workers">Workers Data</SelectItem>
              <SelectItem value="tasks">Tasks Data</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="modificationPrompt">Your Modification Command</Label>
          <Textarea
            id="modificationPrompt"
            placeholder="e.g., Change the status of client C001 to 'Inactive'. Or, For all 'Marketing' tasks, increase their duration by 5."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
            disabled={isLoading}
          />
        </div>

        <Button onClick={() => handleModifyData(false)} disabled={isLoading || !selectedCategory || !prompt.trim()} className="w-full">
          {isLoading && !confirmationNeeded ? (
            <FiLoader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FiCpu className="mr-2 h-4 w-4" />
          )}
          Analyze & Propose Changes
        </Button>

        {confirmationNeeded && proposedInstructions && (
          <div className="mt-6 p-4 border border-blue-500 rounded-lg bg-blue-50/20 text-blue-800 dark:bg-blue-950/20 dark:text-blue-200">
            <h4 className="font-semibold text-lg flex items-center mb-2">
              <FiInfo className="mr-2 h-5 w-5" /> AI Proposed Changes (Confirmation Needed)
            </h4>
            <p className="text-sm mb-3">
              {proposedInstructions.description}
            </p>
            <p className="text-sm font-medium mb-1">Target Category: <span className="capitalize">{proposedInstructions.targetCategory}</span></p>
            <p className="text-sm font-medium mb-1">Filters ({proposedInstructions.filters.length}):</p>
            <ul className="list-disc list-inside text-xs ml-4">
              {proposedInstructions.filters.map((f: DataFilter, idx: number) => (
                <li key={idx}>Column '{f.column}' {f.operator} '{String(f.value)}'</li>
              ))}
            </ul>
            <p className="text-sm font-medium mt-3 mb-1">Actions ({proposedInstructions.actions.length}):</p>
            <ul className="list-disc list-inside text-xs ml-4">
              {proposedInstructions.actions.map((a: DataModificationAction, idx: number) => (
                <li key={idx}>Set column '{a.column}' to '{String(a.newValue)}' (Operation: {a.operation || 'set'})</li>
              ))}
            </ul>
            <div className="flex justify-end space-x-4 mt-4">
              <Button variant="outline" onClick={handleCancelConfirmation} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleConfirmModification} disabled={isLoading}>
                <FiCheckCircle className="mr-2 h-4 w-4" /> Confirm & Apply Changes
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataModifier;
