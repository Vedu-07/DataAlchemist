// src/types/index.ts

// Define a generic type for a row of data, where keys are string and values are any
export type DataRow = { [key: string]: any };

// Defines a suggested correction for an error
export interface SuggestedCorrection {
  column: string; // The column where the correction should apply
  newValue: any;  // The suggested new value
  reason?: string; // Optional: AI's reason for the suggestion
}

// Define the structure for an error flagged during validation
export interface ValidationError {
  row: number;         // The row index where the error occurred (0-indexed)
  column: string;      // The column name where the error occurred
  message: string;     // A descriptive message about the error
  severity?: 'warning' | 'error'; // Optional: severity level
  suggestedCorrection?: SuggestedCorrection; // NEW: Optional AI-suggested correction
}

// Define the overall structure of parsed data, including errors
export interface ParsedData {
  headers: string[];      // Array of column headers
  data: DataRow[];        // Array of data rows
  errors: ValidationError[]; // Array of validation errors
}

// Define the type of file categories we expect
export type FileCategory = 'clients' | 'workers' | 'tasks';

// Specific interfaces for expected data structures (can be expanded later)
export interface ClientData extends DataRow {
  clientId?: string;
  name?: string;
  email?: string;
  status?: string;
  priorityLevel?: number;
  requestedTaskIds?: string;
  groupTag?: string;
  attributesJson?: string;
}

export interface WorkerData extends DataRow {
  workerId?: string;
  workerName?: string;
  skills?: string;
  availableSlots?: string;
  maxLoadPerPhase?: number;
  workerGroup?: string;
  qualificationLevel?: number;
  hourlyRate?: number;
}

export interface TaskData extends DataRow {
  taskId?: string;
  taskName?: string;
  category?: string;
  duration?: number;
  requiredSkills?: string;
  preferredPhases?: string;
  maxConcurrent?: number;
}


// --- Rule Definitions for Milestone 2 ---

// Base interface for any rule
export interface BaseRule {
  id: string; // Unique identifier for the rule
  type: string; // Discriminator for rule type (e.g., 'coRun', 'slotRestriction', 'naturalLanguage')
  description: string; // Human-readable description of the rule
  isEnabled: boolean; // Whether the rule is active
  source: 'manual' | 'ai' | 'naturalLanguage'; // How the rule was created
}

// 1. Co-run Rule: Tasks that must be executed together by the same worker
export interface CoRunRule extends BaseRule {
  type: 'coRun';
  taskIds: string[]; // Array of TaskIDs that must co-run
}

// 2. Slot Restriction Rule: Constraints on client/worker groups regarding common slots
export interface SlotRestrictionRule extends BaseRule {
  type: 'slotRestriction';
  groupType: 'clientGroup' | 'workerGroup'; // Type of group to apply to
  groupName: string; // The specific group name
  minCommonSlots: number; // Minimum number of common slots required
  targetPhases?: number[]; // Optional: restrict to specific phases
}

// 3. Load Limit Rule: Maximum workload per phase for a selected worker group
export interface LoadLimitRule extends BaseRule {
  type: 'loadLimit';
  workerGroup: string; // The worker group this limit applies to
  maxLoad: number; // Maximum load allowed per phase
  phase?: number; // Optional: specific phase, or applies to all phases if undefined
}

// 4. Phase Window Rule: Allowed phase lists or ranges for specific tasks
export interface PhaseWindowRule extends BaseRule {
  type: 'phaseWindow';
  taskId: string; // The TaskID this rule applies to
  allowedPhases: (number | string)[]; // Array of numbers or string ranges (e.g., [1, 2, "4-6"])
}

// 5. Pattern Match Rule: Apply a rule based on a regex pattern match (e.g., on task name)
export interface PatternMatchRule extends BaseRule {
  type: 'patternMatch';
  entity: 'clients' | 'workers' | 'tasks'; // Entity to apply pattern to
  column: string; // Column to check the pattern against
  regex: string; // The regex pattern
  action: 'flag' | 'transform'; // What to do when pattern matches
  actionDetails?: {
    transformTo?: string; // For 'transform' action
    message?: string; // For 'flag' action
  }
}

// 6. Precedence Override Rule: Define explicit priority order for rules
export interface PrecedenceOverrideRule extends BaseRule {
  type: 'precedenceOverride';
  ruleIds: string[]; // Ordered array of rule IDs
}

// This rule type represents a rule proposed by AI from Natural Language input.
export interface NaturalLanguageRule extends BaseRule {
  type: 'naturalLanguage'; // This type indicates it came from NL input
  originalPrompt: string; // The original natural language prompt
  suggestedStructuredRule: Exclude<Rule, NaturalLanguageRule> | null; // The structured rule Gemini interpreted, if any
  aiConfidence?: number; // Optional: AI's confidence score (0-1)
}

// Union type for all possible rule types (excluding NaturalLanguageRule from itself)
export type Rule =
  | CoRunRule
  | SlotRestrictionRule
  | LoadLimitRule
  | PhaseWindowRule
  | PatternMatchRule
  | PrecedenceOverrideRule
  | NaturalLanguageRule;

// Defines the payload expected from Gemini for natural language rule conversion
export interface GeminiRuleConversionResponse {
  success: boolean;
  message: string;
  suggestedRule: Exclude<Rule, NaturalLanguageRule> | null; // Gemini should return a concrete rule type
  confidence?: number;
  error?: string;
}


// --- New Types for Natural Language Data Modification (Milestone 3 - Part 1) ---

// Defines a single filter condition (e.g., "column 'status' equals 'active'")
export interface DataFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with';
  value: any;
}

// Defines a single modification action (e.g., "set column 'status' to 'inactive'")
export interface DataModificationAction {
  column: string;
  newValue: any;
  operation?: 'set' | 'increment' | 'decrement' | 'append' | 'prepend'; // 'set' is default if not specified
}

// Defines the structured instructions Gemini will return for data modification
export interface DataModificationInstructions {
  targetCategory: FileCategory; // The category of data to modify ('clients', 'workers', 'tasks')
  filters: DataFilter[]; // Array of conditions to select rows for modification
  actions: DataModificationAction[]; // Array of modifications to apply to selected rows
  description: string; // A summary of the modification
  confirmationRequired: boolean; // True if the AI thinks user confirmation is highly recommended
}

// Response structure from the /api/modify-data endpoint
export interface GeminiDataModificationResponse {
  success: boolean;
  message: string;
  modifiedData?: DataRow[]; // The updated data rows (only the rows that were actually changed)
  fullUpdatedData?: ParsedData; // Or the full ParsedData object with updated data and new errors if any
  instructions?: DataModificationInstructions; // The structured instructions from Gemini
  error?: string;
  rowCountAffected?: number;
}
