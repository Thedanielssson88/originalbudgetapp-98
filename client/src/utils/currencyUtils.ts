// Currency utilities for converting between SEK (kronor) and ören (öre)
// All amounts in database are stored as ören (öre) - integer values
// All amounts displayed to users are in kronor - decimal values

/**
 * Convert Swedish kronor (SEK) to ören (öre) for database storage
 * @param kronor - Amount in kronor (can be decimal like 123.45)
 * @returns Amount in ören as integer (12345)
 */
export function kronoraToOren(kronor: number): number {
  // Handle null/undefined/NaN
  if (typeof kronor !== 'number' || isNaN(kronor)) {
    return 0;
  }
  
  // Multiply by 100 and round to handle floating point precision issues
  return Math.round(kronor * 100);
}

/**
 * Convert ören (öre) from database to Swedish kronor (SEK) for display
 * @param oren - Amount in ören as integer (12345)  
 * @returns Amount in kronor as decimal (123.45)
 */
export function orenToKronor(oren: number): number {
  // Handle null/undefined/NaN
  if (typeof oren !== 'number' || isNaN(oren)) {
    return 0;
  }
  
  // Divide by 100 to get kronor with decimals
  return oren / 100;
}

/**
 * Format amount in ören as Swedish currency string
 * @param oren - Amount in ören as integer
 * @param showCurrency - Whether to show "kr" suffix (default: true)
 * @returns Formatted string like "123,45 kr" or "123,45"
 */
export function formatOrenAsCurrency(oren: number, showCurrency: boolean = true): string {
  const kronor = orenToKronor(oren);
  
  // Format with Swedish locale (comma as decimal separator)
  const formatted = kronor.toLocaleString('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return showCurrency ? `${formatted} kr` : formatted;
}

/**
 * Parse user input string to ören for database storage
 * Handles various input formats: "123,45", "123.45", "123", etc.
 * @param input - User input string
 * @returns Amount in ören as integer, or 0 if invalid
 */
export function parseInputToOren(input: string): number {
  if (!input || typeof input !== 'string') {
    return 0;
  }
  
  // Clean the input - remove currency symbols and whitespace
  const cleaned = input
    .replace(/\s/g, '') // Remove all whitespace
    .replace(/kr/gi, '') // Remove "kr" or "KR"
    .replace(/sek/gi, '') // Remove "sek" or "SEK"
    .trim();
  
  // Handle Swedish decimal comma format (123,45) and international dot format (123.45)
  let normalized = cleaned;
  
  // If contains both comma and dot, assume comma is thousands separator
  if (normalized.includes(',') && normalized.includes('.')) {
    // Format like 1,234.56 - remove comma thousands separator
    normalized = normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    // Swedish format like 123,45 - replace comma with dot
    normalized = normalized.replace(',', '.');
  }
  
  const number = parseFloat(normalized);
  
  if (isNaN(number)) {
    return 0;
  }
  
  return kronoraToOren(number);
}

/**
 * Validate and clean amount string input
 * @param input - Raw input string
 * @returns Cleaned string suitable for display or empty string if invalid
 */
export function validateAmountInput(input: string): string {
  if (!input) return '';
  
  const oren = parseInputToOren(input);
  if (oren === 0 && input !== '0' && input !== '0,00' && input !== '0.00') {
    return ''; // Invalid input
  }
  
  return formatOrenAsCurrency(oren, false);
}

// Example usage and tests (for development):
/*
console.log('Currency Utils Examples:');
console.log('kronoraToOren(123.45):', kronoraToOren(123.45)); // 12345
console.log('orenToKronor(12345):', orenToKronor(12345)); // 123.45
console.log('formatOrenAsCurrency(12345):', formatOrenAsCurrency(12345)); // "123,45 kr"
console.log('parseInputToOren("123,45"):', parseInputToOren("123,45")); // 12345
console.log('parseInputToOren("123.45"):', parseInputToOren("123.45")); // 12345
console.log('parseInputToOren("123"):', parseInputToOren("123")); // 12300
*/