/**
 * URBAN Design System — token warna & grafik Apple iOS 27 UI Kit.
 * Token permukaan ada di src/index.css (CSS variable) dan dipetakan di tailwind.config.js.
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

/** Latar lembut + teks untuk pill / badge (Official iOS 27 Vibrant System Colors). */
export const PILL_NADA: Record<Nada, string> = {
  positive: "bg-[#34C759]/[0.14] text-[#008932] ring-1 ring-inset ring-[#34C759]/[0.24] dark:bg-[#30D158]/[0.20] dark:text-[#4AD968] dark:ring-[#30D158]/[0.32]",
  negative: "bg-[#FF383C]/[0.13] text-[#E0242A] ring-1 ring-inset ring-[#FF383C]/[0.22] dark:bg-[#FF4245]/[0.20] dark:text-[#FF6B6E] dark:ring-[#FF4245]/[0.32]",
  warning: "bg-[#FF8D28]/[0.15] text-[#C55300] ring-1 ring-inset ring-[#FF8D28]/[0.25] dark:bg-[#FF9230]/[0.20] dark:text-[#FFA952] dark:ring-[#FF9230]/[0.32]",
  tint: "bg-[#0088FF]/[0.13] text-[#0066CC] ring-1 ring-inset ring-[#0088FF]/[0.22] dark:bg-[#0091FF]/[0.22] dark:text-[#45ADFF] dark:ring-[#0091FF]/[0.34]",
  neutral: "bg-fill text-label-2 ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.08]",
};

/** Nada dari tanda angka: + positif, − negatif, 0 netral. */
export const nadaAngka = (n: number): Nada => (n > 0 ? "positive" : n < 0 ? "negative" : "neutral");

/**
 * Warna tanda grafik (batang, titik, garis). Memakai warna resmi Apple iOS 27 UI Kit
 * agar vibran, bersih, namun tetap nyaman dilihat. Angka & label TIDAK memakai warna ini.
 */
export const MARK = {
  masuk: "#34C759",
  keluar: "#FF383C",
  tint: { light: "#0088FF", dark: "#0091FF" },
  netral: { light: "#C7C7CC", dark: "#48484A" },
  modal: { light: "#8E8E93", dark: "#8E8E93" },
  /** Cara bayar */
  tunai: "#34C759",
  transfer: "#0088FF",
} as const;

/** Warna ikon kotak (squircle) & aksen kategori ala Apple iOS 27 System Colors. */
export type WarnaIkon =
  | "blue"
  | "green"
  | "mint"
  | "teal"
  | "cyan"
  | "indigo"
  | "purple"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "gray";

/** Squircle ikon Settings Apple: gradasi vertikal cerah + highlight specular atas 1px. */
const SHEEN_IKON = "shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_2px_6px_rgba(0,0,0,0.12)]";

export const BG_IKON: Record<WarnaIkon, string> = {
  blue: `bg-gradient-to-b from-[#3CA6FF] to-[#0088FF] ${SHEEN_IKON}`,
  green: `bg-gradient-to-b from-[#4EE371] to-[#28CD41] ${SHEEN_IKON}`,
  mint: `bg-gradient-to-b from-[#29E6D0] to-[#00C8B3] ${SHEEN_IKON}`,
  teal: `bg-gradient-to-b from-[#3BE4F0] to-[#00C3D0] ${SHEEN_IKON}`,
  cyan: `bg-gradient-to-b from-[#48DAFF] to-[#00C0E8] ${SHEEN_IKON}`,
  indigo: `bg-gradient-to-b from-[#8177FF] to-[#6155F5] ${SHEEN_IKON}`,
  purple: `bg-gradient-to-b from-[#DF58F2] to-[#CB30E0] ${SHEEN_IKON}`,
  pink: `bg-gradient-to-b from-[#FF5277] to-[#FF2D55] ${SHEEN_IKON}`,
  orange: `bg-gradient-to-b from-[#FFA64D] to-[#FF8D28] ${SHEEN_IKON}`,
  red: `bg-gradient-to-b from-[#FF5E62] to-[#FF383C] ${SHEEN_IKON}`,
  yellow: `bg-gradient-to-b from-[#FFE03B] to-[#FFAE00] ${SHEEN_IKON}`,
  gray: `bg-gradient-to-b from-[#98989D] to-[#6E6E73] ${SHEEN_IKON}`,
};

export type GayaAksen = {
  /** Latar tile / kartu tinted jernih + cincin tipis (gaya Apple Health / Fitness) */
  bg: string;
  /** Latar badge ikon */
  iconBg: string;
  /** Warna glyph ikon & label aksen (Apple HIG accessible contrast) */
  iconText: string;
  /** Pill kategori berwarna */
  pill: string;
  /** Warna solid untuk batang mini / indikator (#RRGGBB 6 digit) */
  bar: string;
  /** Sapuan cahaya sudut untuk kartu hero */
  glow: string;
};

/** Sistem warna aksen Apple iOS 27 (vibrant & bersih, angka nominal tetap text-label). */
export const AKSEN_TILE: Record<WarnaIkon, GayaAksen> = {
  blue: {
    bg: "bg-[#0088FF]/[0.095] dark:bg-[#0091FF]/[0.18] ring-1 ring-[#0088FF]/[0.18] dark:ring-[#0091FF]/[0.30]",
    iconBg: "bg-[#0088FF]/[0.14] dark:bg-[#0091FF]/[0.24]",
    iconText: "text-[#0066CC] dark:text-[#45ADFF]",
    pill: "bg-[#0088FF]/[0.13] text-[#0066CC] dark:bg-[#0091FF]/[0.22] dark:text-[#45ADFF]",
    bar: "#0088FF",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(0, 136, 255, 0.16), transparent 68%)",
  },
  green: {
    bg: "bg-[#34C759]/[0.10] dark:bg-[#30D158]/[0.17] ring-1 ring-[#34C759]/[0.20] dark:ring-[#30D158]/[0.30]",
    iconBg: "bg-[#34C759]/[0.16] dark:bg-[#30D158]/[0.24]",
    iconText: "text-[#008932] dark:text-[#4AD968]",
    pill: "bg-[#34C759]/[0.14] text-[#008932] dark:bg-[#30D158]/[0.22] dark:text-[#4AD968]",
    bar: "#34C759",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(52, 199, 89, 0.16), transparent 68%)",
  },
  mint: {
    bg: "bg-[#00C8B3]/[0.10] dark:bg-[#00DAC3]/[0.17] ring-1 ring-[#00C8B3]/[0.20] dark:ring-[#00DAC3]/[0.30]",
    iconBg: "bg-[#00C8B3]/[0.16] dark:bg-[#00DAC3]/[0.24]",
    iconText: "text-[#008575] dark:text-[#54DFCB]",
    pill: "bg-[#00C8B3]/[0.14] text-[#008575] dark:bg-[#00DAC3]/[0.22] dark:text-[#54DFCB]",
    bar: "#00C8B3",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(0, 200, 179, 0.16), transparent 68%)",
  },
  teal: {
    bg: "bg-[#00C3D0]/[0.095] dark:bg-[#00D2E0]/[0.17] ring-1 ring-[#00C3D0]/[0.20] dark:ring-[#00D2E0]/[0.30]",
    iconBg: "bg-[#00C3D0]/[0.16] dark:bg-[#00D2E0]/[0.24]",
    iconText: "text-[#008198] dark:text-[#3BDDEC]",
    pill: "bg-[#00C3D0]/[0.14] text-[#008198] dark:bg-[#00D2E0]/[0.22] dark:text-[#3BDDEC]",
    bar: "#00C3D0",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(0, 195, 208, 0.16), transparent 68%)",
  },
  cyan: {
    bg: "bg-[#00C0E8]/[0.10] dark:bg-[#3CD3FE]/[0.17] ring-1 ring-[#00C0E8]/[0.20] dark:ring-[#3CD3FE]/[0.30]",
    iconBg: "bg-[#00C0E8]/[0.16] dark:bg-[#3CD3FE]/[0.24]",
    iconText: "text-[#007AA8] dark:text-[#6BDBFF]",
    pill: "bg-[#00C0E8]/[0.14] text-[#007AA8] dark:bg-[#3CD3FE]/[0.22] dark:text-[#6BDBFF]",
    bar: "#00C0E8",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(0, 192, 232, 0.16), transparent 68%)",
  },
  indigo: {
    bg: "bg-[#6155F5]/[0.095] dark:bg-[#6D7CFF]/[0.19] ring-1 ring-[#6155F5]/[0.18] dark:ring-[#6D7CFF]/[0.32]",
    iconBg: "bg-[#6155F5]/[0.14] dark:bg-[#6D7CFF]/[0.25]",
    iconText: "text-[#4B41D1] dark:text-[#A5AEFF]",
    pill: "bg-[#6155F5]/[0.13] text-[#4B41D1] dark:bg-[#6D7CFF]/[0.24] dark:text-[#A5AEFF]",
    bar: "#6155F5",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(97, 85, 245, 0.16), transparent 68%)",
  },
  purple: {
    bg: "bg-[#CB30E0]/[0.095] dark:bg-[#DB34F2]/[0.18] ring-1 ring-[#CB30E0]/[0.18] dark:ring-[#DB34F2]/[0.30]",
    iconBg: "bg-[#CB30E0]/[0.14] dark:bg-[#DB34F2]/[0.25]",
    iconText: "text-[#A421B8] dark:text-[#EB82FA]",
    pill: "bg-[#CB30E0]/[0.13] text-[#A421B8] dark:bg-[#DB34F2]/[0.24] dark:text-[#EB82FA]",
    bar: "#CB30E0",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(203, 48, 224, 0.16), transparent 68%)",
  },
  pink: {
    bg: "bg-[#FF2D55]/[0.095] dark:bg-[#FF375F]/[0.18] ring-1 ring-[#FF2D55]/[0.18] dark:ring-[#FF375F]/[0.30]",
    iconBg: "bg-[#FF2D55]/[0.14] dark:bg-[#FF375F]/[0.24]",
    iconText: "text-[#D91644] dark:text-[#FF6B8B]",
    pill: "bg-[#FF2D55]/[0.13] text-[#D91644] dark:bg-[#FF375F]/[0.22] dark:text-[#FF829E]",
    bar: "#FF2D55",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(255, 45, 85, 0.15), transparent 68%)",
  },
  orange: {
    bg: "bg-[#FF8D28]/[0.10] dark:bg-[#FF9230]/[0.18] ring-1 ring-[#FF8D28]/[0.22] dark:ring-[#FF9230]/[0.30]",
    iconBg: "bg-[#FF8D28]/[0.16] dark:bg-[#FF9230]/[0.25]",
    iconText: "text-[#C55300] dark:text-[#FFA952]",
    pill: "bg-[#FF8D28]/[0.15] text-[#C55300] dark:bg-[#FF9230]/[0.23] dark:text-[#FFA952]",
    bar: "#FF8D28",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(255, 141, 40, 0.16), transparent 68%)",
  },
  red: {
    bg: "bg-[#FF383C]/[0.095] dark:bg-[#FF4245]/[0.18] ring-1 ring-[#FF383C]/[0.18] dark:ring-[#FF4245]/[0.30]",
    iconBg: "bg-[#FF383C]/[0.14] dark:bg-[#FF4245]/[0.24]",
    iconText: "text-[#E0242A] dark:text-[#FF6B6E]",
    pill: "bg-[#FF383C]/[0.13] text-[#E0242A] dark:bg-[#FF4245]/[0.22] dark:text-[#FF6B6E]",
    bar: "#FF383C",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(255, 56, 60, 0.15), transparent 68%)",
  },
  yellow: {
    bg: "bg-[#FFCC00]/[0.13] dark:bg-[#FFD600]/[0.16] ring-1 ring-[#D99B00]/[0.22] dark:ring-[#FFD600]/[0.28]",
    iconBg: "bg-[#FFCC00]/[0.22] dark:bg-[#FFD600]/[0.24]",
    iconText: "text-[#9E6B00] dark:text-[#FFE047]",
    pill: "bg-[#FFCC00]/[0.20] text-[#9E6B00] dark:bg-[#FFD600]/[0.22] dark:text-[#FFE047]",
    bar: "#FFCC00",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(255, 204, 0, 0.16), transparent 68%)",
  },
  gray: {
    bg: "apple-tile ring-1 ring-edge",
    iconBg: "bg-fill",
    iconText: "text-label-2",
    pill: "bg-fill text-label-2",
    bar: "#8E8E93",
    glow: "radial-gradient(85% 75% at 100% 0%, rgba(142, 142, 147, 0.10), transparent 68%)",
  },
};

/** Pemetaan aksen untuk nada semantik (dipakai Card hero & tile status). */
export const nadaKeAksen = (n: Nada): WarnaIkon =>
  n === "positive" ? "green" : n === "negative" ? "red" : n === "warning" ? "orange" : n === "tint" ? "blue" : "gray";

/** Warna seri grafik multi-kategori memakai Apple iOS 27 System Colors. */
export const PALET_SERI = ["#0088FF", "#34C759", "#FF8D28", "#CB30E0", "#FF2D55", "#6155F5"] as const;

/** Warna sumbu / grid / kursor grafik per mode. */
export const temaGrafik = (dark: boolean) => ({
  tick: dark ? "#AEAEB2" : "#636366",
  grid: dark ? "rgba(84,84,88,0.45)" : "rgba(60,60,67,0.10)",
  axis: dark ? "rgba(235,235,245,0.32)" : "rgba(60,60,67,0.30)",
  cursor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  tint: dark ? MARK.tint.dark : MARK.tint.light,
  netral: dark ? MARK.netral.dark : MARK.netral.light,
  modal: dark ? MARK.modal.dark : MARK.modal.light,
});
