export const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export interface AbsenCycleInfo {
  bulanTahun: string; // e.g. "02/26" (matching MM/YY format used across the system)
  labelPeriode: string; // e.g. "27 Jan 2026 - 26 Feb 2026" or "1 - 31 Jan 2026"
  shortLabelPeriode: string; // e.g. "27 Jan - 26 Feb"
  startYear: number;
  startMonth: number;
  startDay: number;
  endYear: number;
  endMonth: number;
  endDay: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Menghitung siklus absensi 1 bulan penuh berdasarkan tanggal dan tanggal mulai (cutoff).
 * Contoh: Jika cutoff = 27:
 * - 2026-01-27 s/d 2026-02-26 -> Masuk siklus 02/26 ("27 Jan 2026 - 26 Feb 2026")
 * - 2026-02-27 s/d 2026-03-26 -> Masuk siklus 03/26 ("27 Feb 2026 - 26 Mar 2026")
 */
export function getAbsenCycleInfo(dateStr: string, cutoffDay: number = 1): AbsenCycleInfo {
  // dateStr format: YYYY-MM-DD
  const parts = (dateStr || '').split('-');
  const y = parseInt(parts[0], 10) || new Date().getFullYear();
  const m = parseInt(parts[1], 10) || (new Date().getMonth() + 1); // 1 - 12
  const d = parseInt(parts[2], 10) || new Date().getDate(); // 1 - 31

  const cutoff = Math.max(1, Math.min(31, Number(cutoffDay) || 1));

  if (cutoff <= 1) {
    const mm = String(m).padStart(2, '0');
    const yy = String(y).slice(-2);
    const lastDay = new Date(y, m, 0).getDate();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m - 1, lastDay, 23, 59, 59);

    return {
      bulanTahun: `${mm}/${yy}`,
      labelPeriode: `1 - ${lastDay} ${BULAN_NAMES[m - 1]} ${y}`,
      shortLabelPeriode: `1 - ${lastDay} ${BULAN_NAMES[m - 1]}`,
      startYear: y,
      startMonth: m,
      startDay: 1,
      endYear: y,
      endMonth: m,
      endDay: lastDay,
      startDate,
      endDate
    };
  }

  // Jika cutoff > 1 (misal 27):
  // Tanggal yang >= cutoff masuk ke siklus bulan berikutnya (contoh: 27 Jan -> siklus 02/26)
  let endYear = y;
  let endMonth = m;
  if (d >= cutoff) {
    endMonth = m + 1;
    if (endMonth > 12) {
      endMonth = 1;
      endYear = y + 1;
    }
  }

  let startYear = endYear;
  let startMonth = endMonth - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear = endYear - 1;
  }

  const mm = String(endMonth).padStart(2, '0');
  const yy = String(endYear).slice(-2);
  const bulanTahun = `${mm}/${yy}`;

  const maxDaysStart = new Date(startYear, startMonth, 0).getDate();
  const maxDaysEnd = new Date(endYear, endMonth, 0).getDate();

  const actualStartDay = Math.min(cutoff, maxDaysStart);
  const actualEndDay = Math.min(cutoff - 1, maxDaysEnd);

  const startDate = new Date(startYear, startMonth - 1, actualStartDay);
  const endDate = new Date(endYear, endMonth - 1, actualEndDay, 23, 59, 59);

  const labelPeriode = `${actualStartDay} ${BULAN_NAMES[startMonth - 1]} ${startYear !== endYear ? startYear : ''} - ${actualEndDay} ${BULAN_NAMES[endMonth - 1]} ${endYear}`.trim();
  const shortLabelPeriode = `${actualStartDay} ${BULAN_NAMES[startMonth - 1]} - ${actualEndDay} ${BULAN_NAMES[endMonth - 1]}`;

  return {
    bulanTahun,
    labelPeriode,
    shortLabelPeriode,
    startYear,
    startMonth,
    startDay: actualStartDay,
    endYear,
    endMonth,
    endDay: actualEndDay,
    startDate,
    endDate
  };
}

/**
 * Menghitung info siklus dari key MM/YY dan cutoffDay
 */
export function getCycleInfoFromBulanTahun(bulanTahun: string, cutoffDay: number = 1): AbsenCycleInfo {
  const [mmStr, yyStr] = (bulanTahun || '').split('/');
  const endMonth = parseInt(mmStr, 10) || (new Date().getMonth() + 1);
  const endYear = 2000 + (parseInt(yyStr, 10) || (new Date().getFullYear() % 100));

  const cutoff = Math.max(1, Math.min(31, Number(cutoffDay) || 1));

  if (cutoff <= 1) {
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    return {
      bulanTahun,
      labelPeriode: `1 - ${lastDay} ${BULAN_NAMES[endMonth - 1]} ${endYear}`,
      shortLabelPeriode: `1 - ${lastDay} ${BULAN_NAMES[endMonth - 1]}`,
      startYear: endYear,
      startMonth: endMonth,
      startDay: 1,
      endYear,
      endMonth,
      endDay: lastDay,
      startDate: new Date(endYear, endMonth - 1, 1),
      endDate: new Date(endYear, endMonth - 1, lastDay, 23, 59, 59)
    };
  }

  let startYear = endYear;
  let startMonth = endMonth - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear = endYear - 1;
  }

  const maxDaysStart = new Date(startYear, startMonth, 0).getDate();
  const maxDaysEnd = new Date(endYear, endMonth, 0).getDate();

  const actualStartDay = Math.min(cutoff, maxDaysStart);
  const actualEndDay = Math.min(cutoff - 1, maxDaysEnd);

  const labelPeriode = `${actualStartDay} ${BULAN_NAMES[startMonth - 1]} ${startYear !== endYear ? startYear : ''} - ${actualEndDay} ${BULAN_NAMES[endMonth - 1]} ${endYear}`.trim();
  const shortLabelPeriode = `${actualStartDay} ${BULAN_NAMES[startMonth - 1]} - ${actualEndDay} ${BULAN_NAMES[endMonth - 1]}`;

  return {
    bulanTahun,
    labelPeriode,
    shortLabelPeriode,
    startYear,
    startMonth,
    startDay: actualStartDay,
    endYear,
    endMonth,
    endDay: actualEndDay,
    startDate: new Date(startYear, startMonth - 1, actualStartDay),
    endDate: new Date(endYear, endMonth - 1, actualEndDay, 23, 59, 59)
  };
}

/**
 * Memastikan format bulanTahun selalu canonical MM/YY (contoh: "02/26")
 */
export function normalizeBulanTahun(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  const parts = trimmed.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    let y = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(y) && m >= 1 && m <= 12) {
      if (y >= 2000) y = y % 100;
      const mm = String(m).padStart(2, '0');
      const yy = String(y).padStart(2, '0');
      return `${mm}/${yy}`;
    }
  }
  return trimmed;
}

/**
 * Normalisasi format tanggal apapun ke standard YYYY-MM-DD
 * Contoh: "31/08/2026", "31-08-2026", "2026-08-31", "2026/08/31" -> "2026-08-31"
 */
export function normalizeDateStr(str: any): string {
  if (!str || typeof str !== 'string') return '';
  const clean = str.trim().replace(/\//g, '-');
  const parts = clean.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return clean;
}

