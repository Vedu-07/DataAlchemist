export type DataRow = { [key: string]: any };


export interface ValidationError {
  row: number;         
  column: string;      
  message: string;     
  severity?: 'warning' | 'error'; 
}


export interface ParsedData {
  headers: string[];      
  data: DataRow[];        
  errors: ValidationError[]; 
}


export type FileCategory = 'clients' | 'workers' | 'tasks';

// Specific interfaces for expected data structures (can be expanded later)
export interface ClientData extends DataRow {
  clientId?: string;
  name?: string;
  email?: string;
  status?: string;
}

export interface WorkerData extends DataRow {
  workerId?: string;
  name?: string;
  skill?: string;
  availability?: string;
}

export interface TaskData extends DataRow {
  taskId?: string;
  description?: string;
  status?: string;
  priority?: string;
}