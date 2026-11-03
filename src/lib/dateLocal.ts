/**
 * Tanggal YYYY-MM-DD menurut jam LOKAL perangkat (WIB).
 * Jangan pakai `toISOString().slice(0, 10)`: itu jam UTC, jadi jam 00:00–06:59 WIB
 * terbaca sebagai tanggal kemarin.
 */
export const toLocalYmd = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/**
 * Filter "Pilih Bulan" tidak punya pilihan tahun. Bulan yang belum terjadi tahun ini
 * berarti bulan itu di tahun lalu (mis. Januari 2027 pilih Desember → Desember 2026).
 */
export const resolveMonthYear = (month: number | string, now: Date = new Date()): number =>
  Number(month) > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear();
