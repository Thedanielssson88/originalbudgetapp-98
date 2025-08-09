// Extended transaction types for the import system

export interface ImportedTransaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  balanceAfter?: number; // Original balance from CSV
  estimatedBalanceAfter?: number; // Calculated balance when CSV is missing
  description: string;
  userDescription?: string; // User's own notes
  bankCategory?: string;
  bankSubCategory?: string;
  bankStatus?: string; // Bank's status from CSV
  reconciled?: string; // Reconciled status from CSV
  
  // App categorization
  appCategoryId?: string;
  appSubCategoryId?: string;
  
  // Transaction type and status
  type: 'Transaction' | 'InternalTransfer' | 'Savings' | 'Sparande' | 'CostCoverage' | 'ExpenseClaim' | 'Income';
  status: 'red' | 'yellow' | 'green'; // Red=needs action, Yellow=auto, Green=approved
  
  // Transfer specific fields
  linkedTransactionId?: string;
  transferToAccount?: string;
  transferFromAccount?: string;
  transferType?: 'intern' | 'sparande' | 'täck_kostnad';
  coveredCostId?: string; // If this transfer covers a specific cost
  correctedAmount?: number; // För "Täck en kostnad"-logiken
  savingsTargetId?: string; // ID för kopplat sparmål eller sparkategori
  linked_saving?: string; // Legacy field name for savingsTargetId
  
  // Metadata
  isManuallyChanged?: boolean; // If user manually changed category, don't override on re-import
  importedAt: string;
  fileSource: string; // Which CSV file this came from
}


export interface FileStructure {
  id: string;
  name: string; // User-friendly name like "Swedbank Format"
  columns: ColumnMapping[];
  fingerprint: string; // Unique identifier based on column names
  isActive: boolean;
  createdAt: Date;
}

export interface ColumnMapping {
  csvColumn: string;
  appField: 'datum' | 'kategori' | 'underkategori' | 'text' | 'belopp' | 'saldo' | 'status' | 'avstamt' | 'ignore';
}

export interface ImportSession {
  id: string;
  startedAt: Date;
  files: ImportedFile[];
  status: 'uploading' | 'mapping' | 'categorizing' | 'completed';
  transactions: ImportedTransaction[];
}

export interface ImportedFile {
  id: string;
  accountId: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  balance?: number;
  dateRange: {
    from: Date;
    to: Date;
  };
  structure: FileStructure;
  uploadedAt: Date;
}

// State for the transaction import system
export interface TransactionImportState {
  currentSession?: ImportSession;
  fileStructures: FileStructure[];
  importHistory: ImportSession[];
}