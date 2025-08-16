console.log('🚨 [DEBUG] Bulletproof import file loaded - LATEST VERSION WITH DATE FIX');

/**
 * BULLETPROOF IMPORT - Zero duplicates, preserves all user data
 * 
 * Strategy:
 * 1. Parse the CSV/XLSX file
 * 2. Send to server with account ID and date range
 * 3. Server creates staging table with parsed transactions
 * 4. Server backs up existing transactions with user data
 * 5. Server deletes all transactions in date range for account
 * 6. Server inserts new transactions from staging
 * 7. Server matches and restores user data from backup
 * 8. Server cleans up staging and backup tables
 */

import { v4 as uuidv4 } from 'uuid';
import { parseCSVContent } from './budgetOrchestrator';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';

interface BulletproofImportResult {
  success: boolean;
  stats: {
    parsed: number;
    deleted: number;
    created: number;
    restored: number;
    duplicatesRemoved: number;
  };
  message: string;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  balanceAfter: number;
  bankCategory?: string;
  bankSubCategory?: string;
  status?: string;
  type?: string;
}

/**
 * Bulletproof Import - Guaranteed no duplicates, preserves all user data
 */
export async function bulletproofImport(
  csvContent: string,
  accountId: string,
  accountName: string,
  categoryRules: any[] = []
): Promise<BulletproofImportResult> {
  
  console.log('🔥 [BULLETPROOF] FUNCTION CALLED - NEW VERSION WITH DATE FIX');
  addMobileDebugLog('🔥 BULLETPROOF FUNCTION CALLED - NEW VERSION');
  
  console.log(`🛡️ [BULLETPROOF] ================================`);
  console.log(`🛡️ [BULLETPROOF] BULLETPROOF IMPORT STARTED`);
  console.log(`🛡️ [BULLETPROOF] Account: ${accountName} (${accountId})`);
  console.log(`🛡️ [BULLETPROOF] Rules: ${categoryRules.length}`);
  console.log(`🛡️ [BULLETPROOF] ================================`);
  addMobileDebugLog(`🛡️ BULLETPROOF: Starting for ${accountName}`);
  
  try {
    // 1. Parse CSV content
    const parsedTransactions = parseCSVContent(csvContent, accountId, 'bulletproof-import');
    
    if (parsedTransactions.length === 0) {
      console.log(`⚠️ [BULLETPROOF] No transactions found in file`);
      return {
        success: false,
        stats: { parsed: 0, deleted: 0, created: 0, restored: 0, duplicatesRemoved: 0 },
        message: 'No transactions found in file'
      };
    }
    
    console.log(`📊 [BULLETPROOF] Parsed ${parsedTransactions.length} transactions from file`);
    addMobileDebugLog(`📊 Parsed ${parsedTransactions.length} transactions`);
    
    // 2. Apply category rules to each transaction
    const processedTransactions: ParsedTransaction[] = [];
    const fingerprintSet = new Set<string>();
    let duplicatesRemoved = 0;
    
    for (const transaction of parsedTransactions) {
      // Create fingerprint for duplicate detection WITHIN the file
      const fingerprint = createFingerprint(
        transaction.date,
        transaction.description,
        transaction.amount
      );
      
      // Skip if we've already seen this exact transaction in the file
      if (fingerprintSet.has(fingerprint)) {
        console.log(`⚠️ [BULLETPROOF] Duplicate in file: ${transaction.description}`);
        duplicatesRemoved++;
        continue;
      }
      fingerprintSet.add(fingerprint);
      
      // No automatic rule application - import raw transactions only
      processedTransactions.push({
        date: transaction.date,
        description: transaction.description,
        amount: Math.round(transaction.amount), // Convert to öre
        balanceAfter: Math.round(transaction.balanceAfter || 0),
        bankCategory: transaction.bankCategory || '',
        bankSubCategory: transaction.bankSubCategory || '',
        status: transaction.status || 'yellow',
        type: transaction.type || 'Transaction'
      });
    }
    
    if (duplicatesRemoved > 0) {
      console.log(`🧹 [BULLETPROOF] Removed ${duplicatesRemoved} duplicates from file`);
      addMobileDebugLog(`🧹 Removed ${duplicatesRemoved} duplicates`);
    }
    
    // 3. Get date range from transactions
    const dates = processedTransactions.map(tx => new Date(tx.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    console.log(`📅 [BULLETPROOF] Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
    console.log(`📊 [BULLETPROOF] Sending ${processedTransactions.length} unique transactions to server`);
    addMobileDebugLog(`📅 Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
    
    // 4. Call bulletproof sync endpoint
    const startTime = Date.now();
    console.log(`⏱️ [BULLETPROOF] Starting bulletproof sync...`);
    console.log(`🔍 [BULLETPROOF] Debug payload:`, {
      accountId,
      startDate: minDate.toISOString(),
      endDate: maxDate.toISOString(),
      transactionCount: processedTransactions.length
    });
    
    console.log(`🌐 [BULLETPROOF] Making API call to /api/transactions/bulletproof-sync...`);
    addMobileDebugLog(`🌐 Making API call to server...`);
    const response = await fetch('/api/transactions/bulletproof-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        startDate: minDate.toISOString(),
        endDate: maxDate.toISOString(),
        transactions: processedTransactions
      })
    });
    
    console.log(`📡 [BULLETPROOF] API response status:`, response.status);
    console.log(`📡 [BULLETPROOF] API response ok:`, response.ok);
    addMobileDebugLog(`📡 API response: ${response.status} (${response.ok ? 'OK' : 'FAILED'})`);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️ [BULLETPROOF] Sync took ${duration} seconds`);
    addMobileDebugLog(`⏱️ Sync took ${duration}s - Account ${accountId} should now have lastUpdate set`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bulletproof sync failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✅ [BULLETPROOF] Sync completed:`, result.stats);
    
    // Debug the server result to see if account update was mentioned
    addMobileDebugLog(`✅ Server result: created ${result.stats.created}, deleted ${result.stats.deleted}`);
    if (result.accountUpdateReached) {
      if (result.accountUpdated) {
        addMobileDebugLog(`🎯 Account lastUpdate was set successfully`);
      } else {
        addMobileDebugLog(`⚠️ Account update code reached but failed`);
      }
    } else {
      addMobileDebugLog(`❌ Account update code was NEVER reached!`);
    }
    
    addMobileDebugLog(`✅ Bulletproof: ${result.stats.created} created, ${result.stats.deleted} deleted, ${result.stats.restored} restored`);
    
    return {
      success: true,
      stats: {
        parsed: parsedTransactions.length,
        deleted: result.stats.deleted || 0,
        created: result.stats.created || 0,
        restored: result.stats.restored || 0,
        duplicatesRemoved: duplicatesRemoved + (result.stats.duplicatesRemoved || 0)
      },
      message: result.message || 'Bulletproof sync completed successfully'
    };
    
  } catch (error) {
    console.error(`❌ [BULLETPROOF] Import failed:`, error);
    addMobileDebugLog(`❌ Bulletproof failed: ${error instanceof Error ? error.message : String(error)}`);
    
    return {
      success: false,
      stats: { parsed: 0, deleted: 0, created: 0, restored: 0, duplicatesRemoved: 0 },
      message: `Import failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Create a fingerprint for a transaction
 */
function createFingerprint(date: string, description: string, amount: number): string {
  // Extract date only (no time)
  const dateOnly = date.split('T')[0];
  
  // Normalize description (lowercase, trim, remove extra spaces)
  const normalizedDesc = description.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Round amount to match server logic (amounts are already in öre)
  const normalizedAmount = Math.round(amount);
  
  return `${dateOnly}_${normalizedDesc}_${normalizedAmount}`;
}