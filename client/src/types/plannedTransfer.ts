// Datamodell för planerade överföringar
export interface PlannedTransfer {
  id: string;          // Unikt ID
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  month: string;       // Format 'YYYY-MM', ex: '2025-08'
  description?: string; // Optional beskrivning av överföringen
  created: string;     // ISO timestamp när överföringen skapades
  transferType: 'monthly' | 'daily'; // Fast månadsöverföring vs Daglig överföring
  // Daily transfer specific fields
  dailyAmount?: number; // Amount per day for daily transfers
  transferDays?: number[]; // Days of week (0=Sunday, 1=Monday, etc.) for daily transfers
  // Category fields
  huvudkategoriId?: string; // UUID of main category
  underkategoriId?: string; // UUID of subcategory
}