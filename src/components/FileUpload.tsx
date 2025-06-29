'use client';

import React, { useCallback, useState } from 'react';
import { parseFile, validateData } from '@/lib/dataProcessor';
import { ParsedData, FileCategory, ValidationError } from '@/types';
import { FiUploadCloud, FiFileText, FiUsers, FiTool, FiBriefcase, FiLoader } from 'react-icons/fi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface FileUploadProps {
  onDataParsed: (category: FileCategory, data: ParsedData) => void;
  onFileTypeError: (message: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataParsed, onFileTypeError }) => {
  const [selectedFileNames, setSelectedFileNames] = useState<Partial<Record<FileCategory, string>>>({});
  const [isLoading, setIsLoading] = useState<Partial<Record<FileCategory, boolean>>>({});

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, category: FileCategory) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(prev => ({ ...prev, [category]: true }));
    setSelectedFileNames(prev => ({ ...prev, [category]: file.name }));

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(fileExtension || '')) {
      onFileTypeError('Invalid file type. Please upload a .csv or .xlsx file.');
      event.target.value = '';
      setIsLoading(prev => ({ ...prev, [category]: false }));
      setSelectedFileNames(prev => ({ ...prev, [category]: undefined }));
      return;
    }

    try {
      const parsedData = await parseFile(file);
      const validationErrors: ValidationError[] = validateData(parsedData.data, category);
      const finalErrors = [...parsedData.errors, ...validationErrors];

      onDataParsed(category, {
        headers: parsedData.headers,
        data: parsedData.data,
        errors: finalErrors,
      });

      event.target.value = '';
    } catch (error: unknown) { 
      console.error('Error processing file:', error);
      let errorMessage = 'An unknown error occurred.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      onFileTypeError(`Error processing file: ${errorMessage}`);
      event.target.value = '';
      setSelectedFileNames(prev => ({ ...prev, [category]: undefined }));
    } finally {
      setIsLoading(prev => ({ ...prev, [category]: false }));
    }
  }, [onDataParsed, onFileTypeError]);

  const UploadCard: React.FC<{
    category: FileCategory;
    title: string;
    description: string;
    icon: React.ElementType;
  }> = ({ category, title, description, icon: Icon }) => (
    <Card className="group relative p-4 flex flex-col justify-between h-[180px] border-muted hover:border-primary transition-colors">
      <label htmlFor={`file-upload-${category}`} className="absolute inset-0 cursor-pointer z-10" />
      <Input
        id={`file-upload-${category}`}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => handleFileChange(e, category)}
        disabled={isLoading[category]}
      />

      <div className="flex items-center gap-3">
        {isLoading[category] ? (
          <FiLoader className="animate-spin text-primary text-2xl" />
        ) : (
          <Icon className="text-primary text-2xl" />
        )}
        <CardTitle className="text-base font-semibold text-foreground">
          {title}
        </CardTitle>
      </div>

      <CardDescription className="text-sm text-muted-foreground mt-2">
        {description}
      </CardDescription>

      {selectedFileNames[category] ? (
        <div className="flex items-center text-sm mt-4 p-1.5 px-2 bg-primary/10 rounded border border-primary/20 text-primary truncate">
          <FiFileText className="mr-2 text-base" />
          <span className="truncate">{selectedFileNames[category]}</span>
        </div>
      ) : !isLoading[category] && (
        <div className="flex items-center text-sm text-muted-foreground mt-4 group-hover:text-primary">
          <FiUploadCloud className="mr-1 text-base" />
          Upload file
        </div>
      )}
    </Card>
  );

  return (
    <Card className="p-6 md:p-8">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold text-foreground">
          Data Onboarding Hub
        </CardTitle>
        <CardDescription className="text-muted-foreground mt-2">
          Upload your core datasets to begin analysis and optimization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UploadCard
            category="clients"
            title="Clients"
            description="Client details and preferences."
            icon={FiUsers}
          />
          <UploadCard
            category="workers"
            title="Workers"
            description="Worker roles and availability."
            icon={FiTool}
          />
          <UploadCard
            category="tasks"
            title="Tasks"
            description="Task metadata and dependencies."
            icon={FiBriefcase}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
