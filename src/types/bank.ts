// Bank related types for CSV import functionality

export interface Bank {
  id: string;
  name: string;
  createdAt: string;
}

export interface BankCSVMapping {
  id: string;
  bankId: string;
  name: string; // User-friendly name like "Danske Bank Standard Format"
  columns: ColumnMapping[];
  fingerprint: string; // Unique identifier based on column names
  isActive: boolean;
  createdAt: string;
}

export interface ColumnMapping {
  csvColumn: string;
  appField: 'datum' | 'kategori' | 'underkategori' | 'text' | 'belopp' | 'saldo' | 'status' | 'avstamt' | 'ignore';
}