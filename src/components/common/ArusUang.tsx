import React from "react";
import { Scale, TrendingDown, TrendingUp } from "lucide-react";
import { rupiah } from "../../lib/format";

/**
 * ARUS UANG — potongan UI bersama Analitik Keseluruhan & Analitik Usaha (SSOT).
 * Warna seri lolos validator palet (terang & gelap). Angka & label selalu memakai warna teks,
 * warna seri hanya untuk titik / batang.
 */
export const WARNA_MASUK = "#0d9488";
export const WARNA_KELUAR = "#e11d48";

/** +Rp 1.000 / −Rp 1.000 */
export const rpTanda = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${rupiah(Math.abs(n))}`;
export const persen = (n: number) => `${Number.isFinite(n) ? (Math.abs(n) >= 10 || n === 0 ? n.toFixed(0) : n.toFixed(1).replace(".", ",")) : "0"}%`;

export const Titik: React.FC<{ c: string; className?: string }> = ({ c, className = "" }) => (
  <span aria-hidden className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`} style={{ background: c }} />
);

/** Label status hasil: SURPLUS / MINUS / IMBANG — selalu ikon + teks, tidak hanya warna. */
export const StatusArus: React.FC<{ net: number; size?: "sm" | "md" }> = ({ net, size = "md" }) => {
  const s =
    net > 0
      ? { t: "SURPLUS", i: <TrendingUp className="w-3.5 h-3.5" />, cls: "bg-teal-50 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200" }
      : net < 0
      ? { t: "MINUS", i: <TrendingDown className="w-3.5 h-3.5" />, cls: "bg-rose-50 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200" }
      : { t: "IMBANG", i: <Scale className="w-3.5 h-3.5" />, cls: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200" };
  return (
    <span className={`inline-flex items-center gap-1 shrink-0 rounded-full font-black tracking-wider ${size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"} ${s.cls}`}>
      {s.i}
      {s.t}
    </span>
  );
};

/** Kotak "Uang masuk" / "Uang keluar". */
export const ArusTile: React.FC<{ jenis: "masuk" | "keluar"; value: number; sub?: string }> = ({ jenis, value, sub }) => {
  const s = rupiah(value);
  return (
    <div className="rounded-2xl bg-zinc-50 dark:bg-white/5 px-3.5 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
        <Titik c={jenis === "masuk" ? WARNA_MASUK : WARNA_KELUAR} />
        {jenis === "masuk" ? "Uang masuk" : "Uang keluar"}
      </div>
      <div className={`mt-1 font-black tabular-nums tracking-tight leading-tight text-zinc-900 dark:text-white ${s.length > 13 ? "text-[14.5px]" : "text-[17px]"}`}>{s}</div>
      {sub && <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
};

/** Satu baris rincian uang: titik warna + label (+ catatan) · nominal. */
export const BarisUang: React.FC<{ jenis: "masuk" | "keluar"; label: string; note?: string; value: number; bold?: boolean }> = ({ jenis, label, note, value, bold }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="flex items-center gap-2 min-w-0">
      <Titik c={jenis === "masuk" ? WARNA_MASUK : WARNA_KELUAR} />
      <span className={`truncate ${bold ? "font-bold text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`}>{label}</span>
      {note && <span className="text-[11.5px] text-zinc-400 shrink-0">{note}</span>}
    </span>
    <span className={`tabular-nums shrink-0 text-zinc-900 dark:text-white ${bold ? "font-black" : "font-bold"} ${value === 0 ? "opacity-40" : ""}`}>
      {jenis === "keluar" && value > 0 ? "− " : ""}
      {rupiah(value)}
    </span>
  </div>
);

/** Baris batang horizontal (rincian sumber / kategori). Warna batang = jenis arus. */
export const BatangUang: React.FC<{ label: string; sub?: string; value: number; max: number; jenis: "masuk" | "keluar" }> = ({ label, sub, value, max, jenis }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="font-bold text-zinc-800 dark:text-zinc-100 min-w-0 truncate">{label}</span>
      <span className="font-black tabular-nums text-zinc-900 dark:text-white shrink-0">{rupiah(value)}</span>
    </div>
    <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-white/5 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / Math.max(1, max)) * 100)}%`, background: jenis === "masuk" ? WARNA_MASUK : WARNA_KELUAR }} />
    </div>
    {sub && <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{sub}</div>}
  </div>
);

/** Kartu standar analitik (sama dengan kartu Analitik Usaha). */
export const KartuAnalitik: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  icon,
  right,
  children,
  className = "",
}) => (
  <section className={`rounded-[22px] bg-white dark:bg-[#1c1c1e] border border-zinc-200/80 dark:border-white/10 p-4 shadow-sm ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-[15px] font-black text-zinc-900 dark:text-white min-w-0">
        {icon}
        <span className="truncate">{title}</span>
      </h3>
      {right}
    </div>
    {children}
  </section>
);

/** Legenda kecil seri grafik (teks memakai warna teks). */
export const LegendaArus: React.FC<{ items?: { c: string; l: string }[] }> = ({
  items = [
    { c: WARNA_MASUK, l: "Masuk" },
    { c: WARNA_KELUAR, l: "Keluar" },
  ],
}) => (
  <div className="flex items-center gap-3 shrink-0 text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
    {items.map((x) => (
      <span key={x.l} className="inline-flex items-center gap-1.5">
        <Titik c={x.c} />
        {x.l}
      </span>
    ))}
  </div>
);
