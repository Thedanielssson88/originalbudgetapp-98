// Datamodell för planerade överföringar
export interface PlannedTransfer {
  id: string;          // Unikt ID
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  month: string;       // Format 'YYYY-MM', ex: '2025-08'
  description?: string; // Optional beskrivning av överföringen
  created: string;     // ISO timestamp när överföringen skapades
}