/**
 * Utility functions for week calculation
 * Used for pricelist weekly identity
 */

/**
 * Get the start of the week (Monday 00:00:00) for a given date
 * @param date - Date to calculate week start for (defaults to now)
 * @param timezone - Timezone string (defaults to UTC)
 * @returns Date object representing Monday 00:00:00 of the week
 */
export function getWeekStart(date: Date = new Date(), timezone: string = 'UTC'): Date {
  const d = new Date(date);
  
  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = d.getDay();
  
  // Calculate days to subtract to get to Monday
  // If it's Sunday (0), subtract 6 days to get to Monday
  // Otherwise, subtract (day - 1) to get to Monday
  const daysToSubtract = day === 0 ? 6 : day - 1;
  
  // Create a new date for Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysToSubtract);
  monday.setHours(0, 0, 0, 0);
  monday.setMilliseconds(0);
  
  return monday;
}

/**
 * Get the end of the week (Sunday 23:59:59.999) for a given week start
 * @param weekStart - Monday date of the week
 * @returns Date object representing Sunday 23:59:59.999 of the week
 */
export function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get Sunday
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Check if a date falls within a given week
 * @param date - Date to check
 * @param weekStart - Monday date of the week
 * @returns true if date is within the week
 */
export function isDateInWeek(date: Date, weekStart: Date): boolean {
  const weekEnd = getWeekEnd(weekStart);
  return date >= weekStart && date <= weekEnd;
}
