/**
 * FORMAT ANGKA & TEKS — satu sumber untuk seluruh aplikasi.
 * Jangan membuat formatter rupiah / parser angka lokal di komponen.
 */

/** Rupiah penuh: "Rp 1.234.000" · negatif "-Rp 5.000" (dibulatkan ke rupiah). */
export const rupiah = (n: number | string | null | undefined): string => {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? "-" : ""}Rp ${Math.abs(v).toLocaleString("id-ID")}`;
};

/** Rupiah ringkas untuk sumbu grafik & angka kecil: 1,2 jt · 450 rb · 1,1 M */
export const rpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(Math.round(n));
};

/** Rupiah bertanda untuk hasil / selisih: "+Rp 1.000" · "−Rp 1.000" (tanda minus tipografi) · "Rp 0". */
export const rupiahTanda = (n: number): string => {
  const v = Math.round(Number(n) || 0);
  return `${v > 0 ? "+" : v < 0 ? "\u2212" : ""}${rupiah(Math.abs(v))}`;
};

/** Persen ringkas: 7,5% · 42% · 0% (desimal hanya di bawah 10%). */
export const persen = (n: number): string =>
  `${Number.isFinite(n) ? (Math.abs(n) >= 10 || n === 0 ? n.toFixed(0) : n.toFixed(1).replace(".", ",")) : "0"}%`;

/** Ribuan untuk laporan teks: 1.919.000 -> "1.919k" (0 -> ""). */
export const formatK = (n: number) => (n ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(n / 1000)}k` : "");

/**
 * Angka bulat dari input bebas ("50.000", "Rp 50.000", 50000, "") — pemisah ribuan diabaikan.
 * Dipakai untuk semua kolom harga / nominal.
 */
export const toInt = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;
  const n = parseInt(String(v ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/** Angka dengan nol di depan: pad(7) -> "07", pad(5, 3) -> "005". */
export const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** "12 Nov" dari YYYY-MM-DD */
export const formatDateShort = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

/** "12/11/26" dari YYYY-MM-DD (laporan teks WhatsApp). */
export const tanggalAngka = (tgl: string) => {
  const m = String(tgl || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
  const d = new Date(tgl);
  return isNaN(d.getTime()) ? String(tgl || "") : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};
