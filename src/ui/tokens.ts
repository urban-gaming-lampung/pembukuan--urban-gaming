/**
 * URBAN Design System — token versi JavaScript (untuk grafik & warna yang tidak bisa memakai kelas Tailwind).
 * Token warna utama ada di src/index.css (CSS variable) dan dipetakan di tailwind.config.js.
 * Aturan lengkap: src/ui/DESIGN.md
 */

/** Nada makna. Warna hanya dipakai untuk makna, bukan hiasan. */
export type Nada = "positive" | "negative" | "warning" | "tint" | "neutral";

/** Warna teks per nada (kontras ≥ 4,5:1 di kartu terang & gelap). */
export const TEKS_NADA: Record<Nada, string> = {
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
  tint: "text-tint",
  neutral: "text-label",
};

/** Latar lembut + teks untuk pill / badge. */
export const PILL_NADA: Record<Nada, string> = {
  positive: "bg-positive/10 text-positive dark:bg-positive/15",
  negative: "bg-negative/10 text-negative dark:bg-negative/15",
  warning: "bg-warning/10 text-warning dark:bg-warning/15",
  tint: "bg-tint/10 text-tint dark:bg-tint/15",
  neutral: "bg-fill text-label-2",
};

/** Nada dari tanda angka: + positif, − negatif, 0 netral. */
export const nadaAngka = (n: number): Nada => (n > 0 ? "positive" : n < 0 ? "negative" : "neutral");

/**
 * Warna tanda grafik (batang, titik, garis). Pasangan masuk/keluar lolos validator palet
 * (aman buta warna, kontras ≥ 3:1 di terang & gelap). Angka & label TIDAK memakai warna ini.
 */
export const MARK = {
  masuk: "#0d9488",
  keluar: "#e11d48",
  tint: { light: "#007aff", dark: "#0a84ff" },
  netral: { light: "#c7c7cc", dark: "#545458" },
  modal: { light: "#a1a1a6", dark: "#636366" },
  /** Cara bayar (lolos validator berdampingan) */
  tunai: "#0d9488",
  transfer: "#007aff",
} as const;

/** Warna ikon kotak (squircle) ala menu Pengaturan iOS — identitas kategori, glyph selalu putih. */
export type WarnaIkon = "blue" | "green" | "teal" | "indigo" | "orange" | "red" | "pink" | "purple" | "yellow" | "gray";
export const BG_IKON: Record<WarnaIkon, string> = {
  blue: "bg-[#007AFF]",
  green: "bg-[#34C759]",
  teal: "bg-[#30B0C7]",
  indigo: "bg-[#5856D6]",
  orange: "bg-[#FF9500]",
  red: "bg-[#FF3B30]",
  pink: "bg-[#FF2D55]",
  purple: "bg-[#AF52DE]",
  yellow: "bg-[#FFCC00]",
  gray: "bg-[#8E8E93]",
};

/** Warna sumbu / grid / kursor grafik per mode. */
export const temaGrafik = (dark: boolean) => ({
  tick: dark ? "#8e8e93" : "#8e8e93",
  grid: dark ? "rgba(84,84,88,0.45)" : "rgba(60,60,67,0.10)",
  axis: dark ? "rgba(235,235,245,0.30)" : "rgba(60,60,67,0.30)",
  cursor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  tint: dark ? MARK.tint.dark : MARK.tint.light,
  netral: dark ? MARK.netral.dark : MARK.netral.light,
  modal: dark ? MARK.modal.dark : MARK.modal.light,
});
