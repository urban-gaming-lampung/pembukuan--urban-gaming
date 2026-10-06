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
 * Batas tanggal cutoff yang namanya mengikuti bulan AWAL siklus.
 * - Cutoff 1          : siklus = bulan kalender penuh (1 - akhir bulan).
 * - Cutoff 2 s/d 15   : siklus dinamai bulan tempat siklus DIMULAI.
 *                       Contoh cutoff 2: 2 Okt - 1 Nov  -> Oktober (10/26).
 * - Cutoff 16 s/d 31  : siklus dinamai bulan tempat siklus BERAKHIR.
 *                       Contoh cutoff 27: 27 Sep - 26 Okt -> Oktober (10/26).
 * Aturan ini mengikuti bulan yang memuat mayoritas hari dalam siklus,
 * sehingga absensi dan gaji tidak pernah "loncat" ke bulan berikutnya.
 */
export const CYCLE_LABEL_AS_START_MAX_CUTOFF = 15;

function normalizeCutoff(cutoffDay: number): number {
  return Math.max(1, Math.min(31, Number(cutoffDay) || 1));
}

/**
 * Tanggal hari ini (WIB) dalam format YYYY-MM-DD.
 */
export function getTodayYmd(): string {
  return new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 10);
}

function buildCycle(
  startYear: number,
  startMonth: number,
  cutoff: number,
  labelAsStart: boolean
): AbsenCycleInfo {
  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth > 12) {
    endMonth = 1;
    endYear = startYear + 1;
  }

  const maxDaysStart = new Date(startYear, startMonth, 0).getDate();
  const maxDaysEnd = new Date(endYear, endMonth, 0).getDate();
  const actualStartDay = Math.min(cutoff, maxDaysStart);
  const actualEndDay = Math.min(cutoff - 1, maxDaysEnd);

  const labelYear = labelAsStart ? startYear : endYear;
  const labelMonth = labelAsStart ? startMonth : endMonth;
  const bulanTahun = `${String(labelMonth).padStart(2, '0')}/${String(labelYear).slice(-2)}`;

  const labelPeriode = `${actualStartDay} ${BULAN_NAMES[startMonth - 1]} ${startYear !== endYear ? startYear : ''} - ${actualEndDay} ${BULAN_NAMES[endMonth - 1]} ${endYear}`.replace(/\s+/g, ' ').trim();
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

function buildCalendarMonthCycle(y: number, m: number): AbsenCycleInfo {
  const mm = String(m).padStart(2, '0');
  const yy = String(y).slice(-2);
  const lastDay = new Date(y, m, 0).getDate();
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
    startDate: new Date(y, m - 1, 1),
    endDate: new Date(y, m - 1, lastDay, 23, 59, 59)
  };
}

/**
 * Menghitung siklus absensi 1 bulan penuh berdasarkan tanggal dan tanggal mulai (cutoff).
 * Penamaan siklus (bulanTahun) mengikuti bulan yang memuat mayoritas hari:
 * - cutoff 1  : 1 Okt - 31 Okt          -> 10/26
 * - cutoff 2  : 2 Okt - 1 Nov           -> 10/26
 * - cutoff 27 : 27 Sep - 26 Okt         -> 10/26
 */
export function getAbsenCycleInfo(dateStr: string, cutoffDay: number = 1): AbsenCycleInfo {
  // dateStr format: YYYY-MM-DD
  const parts = (dateStr || '').split('-');
  const y = parseInt(parts[0], 10) || new Date().getFullYear();
  const m = parseInt(parts[1], 10) || (new Date().getMonth() + 1); // 1 - 12
  const d = parseInt(parts[2], 10) || new Date().getDate(); // 1 - 31

  const cutoff = normalizeCutoff(cutoffDay);
  if (cutoff <= 1) return buildCalendarMonthCycle(y, m);

  // Siklus dimulai di bulan ini jika tanggal >= cutoff, selain itu dimulai di bulan sebelumnya.
  let startYear = y;
  let startMonth = m;
  if (d < cutoff) {
    startMonth = m - 1;
    if (startMonth < 1) {
      startMonth = 12;
      startYear = y - 1;
    }
  }

  return buildCycle(startYear, startMonth, cutoff, cutoff <= CYCLE_LABEL_AS_START_MAX_CUTOFF);
}

/**
 * Menghitung info siklus dari key MM/YY dan cutoffDay
 */
export function getCycleInfoFromBulanTahun(bulanTahun: string, cutoffDay: number = 1): AbsenCycleInfo {
  const [mmStr, yyStr] = (bulanTahun || '').split('/');
  const labelMonth = parseInt(mmStr, 10) || (new Date().getMonth() + 1);
  const labelYear = 2000 + (parseInt(yyStr, 10) || (new Date().getFullYear() % 100));

  const cutoff = normalizeCutoff(cutoffDay);
  if (cutoff <= 1) return buildCalendarMonthCycle(labelYear, labelMonth);

  if (cutoff <= CYCLE_LABEL_AS_START_MAX_CUTOFF) {
    // Label = bulan awal siklus
    return buildCycle(labelYear, labelMonth, cutoff, true);
  }

  // Label = bulan akhir siklus
  let startYear = labelYear;
  let startMonth = labelMonth - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear = labelYear - 1;
  }
  return buildCycle(startYear, startMonth, cutoff, false);
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
 * Contoh: "31/08/2026", "08/31/2026", "31-08-2026", "2026-08-31", "2026/08/31" -> "2026-08-31"
 */
export function normalizeDateStr(str: any): string {
  if (!str || typeof str !== 'string') return '';
  const clean = str.trim().replace(/\//g, '-');
  const parts = clean.split('-');
  if (parts.length === 3) {
    // Case 1: Starts with 4-digit year (YYYY-MM-DD or YYYY-DD-MM)
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Case 2: Ends with 4-digit year (DD-MM-YYYY or MM-DD-YYYY)
    if (parts[2].length === 4) {
      const y = parts[2];
      const n0 = parseInt(parts[0], 10);
      const n1 = parseInt(parts[1], 10);
      
      if (!isNaN(n0) && !isNaN(n1)) {
        // If first part > 12, it must be DD-MM-YYYY (e.g. 31-08-2026)
        if (n0 > 12 && n1 <= 12) {
          const d = String(n0).padStart(2, '0');
          const m = String(n1).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        // If second part > 12, it must be MM-DD-YYYY (e.g. 08-31-2026)
        if (n1 > 12 && n0 <= 12) {
          const m = String(n0).padStart(2, '0');
          const d = String(n1).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        // Default Indonesian format DD-MM-YYYY (e.g. 05-08-2026 -> 5 Agustus)
        const d = String(n0).padStart(2, '0');
        const m = String(n1).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }
  return clean;
}

/**
 * Cek apakah log absensi cocok dengan tanggal target.
 * SSOT: Jika log memiliki field `tanggal` (tanggal pembukuan/shift), maka `tanggal` adalah acuan mutlak.
 * Field lain (tanggalReal, waktu, timestamp, id) hanya sebagai fallback jika field `tanggal` kosong.
 */
export function isLogForDate(log: any, targetTanggal: string): boolean {
  if (!log || !targetTanggal) return false;
  const normTarget = normalizeDateStr(targetTanggal);
  if (!normTarget) return false;

  // 1. Primary SSOT: If log has an explicit `tanggal`, it MUST match targetTanggal
  if (log.tanggal && typeof log.tanggal === 'string' && log.tanggal.trim()) {
    return normalizeDateStr(log.tanggal) === normTarget;
  }

  // 2. Fallbacks only if log.tanggal is missing/empty:
  if (log.tanggalReal && normalizeDateStr(log.tanggalReal) === normTarget) return true;
  if (log.waktu && typeof log.waktu === 'string') {
    const parts = log.waktu.split(' - ');
    for (const p of parts) {
      if (normalizeDateStr(p.trim()) === normTarget) return true;
    }
  }
  if (log.timestamp && typeof log.timestamp === 'string') {
    const tsDate = log.timestamp.slice(0, 10);
    if (normalizeDateStr(tsDate) === normTarget) return true;
  }
  if (log.id && typeof log.id === 'string') {
    const idDate = log.id.slice(0, 10);
    if (normalizeDateStr(idDate) === normTarget) return true;
  }
  return false;
}



