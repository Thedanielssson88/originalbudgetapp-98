// Date utilities for handling Date objects vs strings throughout the app

/**
 * Formats a Date object to YYYY-MM-DD string format
 */
export function formatDateToString(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
}

/**
 * Formats a Date object for display (readable format)
 */
export function formatDateForDisplay(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('sv-SE'); // Uses YYYY-MM-DD format in Swedish locale
}

/**
 * Converts a string date to Date object
 */
export function parseStringToDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Ensures a date value (string or Date) is returned as a Date object
 */
export function ensureDate(date: string | Date): Date | null {
  if (!date) return null;
  
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  
  return parseStringToDate(date);
}

/**
 * Compares two dates ignoring time (only comparing YYYY-MM-DD)
 */
export function compareDatesOnly(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  
  return d1.getTime() - d2.getTime();
}

/**
 * Checks if a date is within a range (inclusive, comparing only date part)
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
}

/**
 * Creates a date key for grouping (YYYY-MM-DD string)
 */
export function createDateKey(date: Date): string {
  return formatDateToString(date);
}

/**
 * Creates a month key for grouping (YYYY-MM string)
 */
export function createMonthKey(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}