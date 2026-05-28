/**
 * Formats a Date object to "YYYY-MM" string key using Asia/Jakarta timezone.
 * @param date The date to format, defaults to current time.
 */
export function getMonthKey(date: Date = new Date()): string {
  // Convert date to Asia/Jakarta timezone string
  const wibString = date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const wibDate = new Date(wibString);
  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Computes the previous month's key given a month key in "YYYY-MM" format.
 * @param monthKey The month key to calculate from (e.g. "2026-05").
 */
export function getPrevMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }

  const prevMonthStr = String(month).padStart(2, '0');
  return `${year}-${prevMonthStr}`;
}
