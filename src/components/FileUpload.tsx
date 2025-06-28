'use client';

import React, { useCallback, useState } from 'react';
import { parseFile, validateData } from '@/lib/dataProcessor';
import { ParsedData, FileCategory, ValidationError } from '@/types';
import { FiUploadCloud, FiFileText } from 'react-icons/fi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; 
import { Input } from '@/components/ui/input'; 

interface FileUploadProps {
  onDataParsed: (category: FileCategory, data: ParsedData) => void;
  onFileTypeError: (message: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataParsed, onFileTypeError }) => {
  const [selectedFileNames, setSelectedFileNames] = useState<Partial<Record<FileCategory, string>>>({});

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, category: FileCategory) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(fileExtension || '')) {
      onFileTypeError('Invalid file type. Please upload a .csv or .xlsx file.');
      event.target.value = '';
      return;
    }

    setSelectedFileNames(prev => ({ ...prev, [category]: file.name }));

    try {
      const parsedData = await parseFile(file);
      const validationErrors: ValidationError[] = validateData(parsedData.data, category);
      const allErrors = [...parsedData.errors, ...validationErrors];

      onDataParsed(category, {
        headers: parsedData.headers,
        data: parsedData.data,
        errors: allErrors,
      });

      event.target.value = '';
    } catch (error: any) {
      console.error('Error processing file:', error);
      onFileTypeError(`Error processing file: ${error.message || 'An unknown error occurred.'}`);
      event.target.value = '';
    }
  }, [onDataParsed, onFileTypeError]);

  const UploadCard: React.FC<{ category: FileCategory; title: string; description: string; icon: React.ElementType }> = ({ category, title, description, icon: Icon }) => (
    <Card className="relative flex flex-col items-center justify-center border-2 border-dashed border-primary-foreground/20 rounded-lg p-6 bg-card hover:bg-muted transition-colors cursor-pointer group">
      <Input
        id={`file-upload-${category}`}
        type="file"
        accept=".csv,.xlsx"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => handleFileChange(e, category)}
      />
      <Icon className="text-primary text-4xl mb-3 group-hover:text-primary-foreground transition-colors" />
      <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary-foreground transition-colors">{title}</CardTitle>
      <CardDescription className="text-muted-foreground text-sm mt-1 group-hover:text-primary-foreground/80 transition-colors">{description}</CardDescription>
      {selectedFileNames[category] && (
        <div className="mt-2 text-sm text-muted-foreground flex items-center group-hover:text-primary-foreground/70 transition-colors">
          <FiFileText className="mr-1" /> {selectedFileNames[category]}
        </div>
      )}
    </Card>
  );

  return (
    <Card className="p-6 md:p-8">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold text-foreground">Upload Your Data</CardTitle>
        <CardDescription className="text-muted-foreground mt-2">
          Select your `clients`, `workers`, and `tasks` files.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UploadCard category="clients" title="Upload Clients Data" description="CSV or XLSX" icon={FiUploadCloud} />
          <UploadCard category="workers" title="Upload Workers Data" description="CSV or XLSX" icon={FiUploadCloud} />
          <UploadCard category="tasks" title="Upload Tasks Data" description="CSV or XLSX" icon={FiUploadCloud} />
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;