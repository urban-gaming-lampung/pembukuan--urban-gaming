import React from "react";
import { ChevronRight, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { rpShort, rupiah, rupiahTanda } from "../lib/format";
import { nadaAngka, PILL_NADA, TEKS_NADA, type Nada } from "./tokens";

/**
 * ANGKA & DATA — nominal, tile ringkasan, pill status, batang proporsi.
 * Angka selalu tabular-nums; warna hanya untuk makna (surplus / minus / peringatan).
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const UKURAN = {
  display: "text-display",
  title1: "text-title1",
  title2: "text-title2",
  title3: "text-title3",
  headline: "text-headline font-bold",
  subhead: "text-subhead font-semibold",
  footnote: "text-footnote font-semibold",
} as const;
export type UkuranAngka = keyof typeof UKURAN;
/** Ukuran satu tingkat lebih kecil untuk angka yang panjang (supaya tidak terpotong di HP). */
const LEBIH_KECIL: Record<UkuranAngka, UkuranAngka> = {
  display: "title1",
  title1: "title2",
  title2: "title3",
  title3: "headline",
  headline: "subhead",
  subhead: "footnote",
  footnote: "footnote",
};

/**
 * Nominal rupiah. `signed` menampilkan +/− ; `tone="auto"` mewarnai sesuai tanda
 * (hijau surplus, merah minus). `short` = ringkas (1,2 jt). `fitAt` = jumlah karakter
 * sebelum ukuran diturunkan satu tingkat.
 */
export const Amount: React.FC<{
  value: number;
  signed?: boolean;
  tone?: "auto" | Nada;
  size?: UkuranAngka;
  short?: boolean;
  fitAt?: number;
  className?: string;
}> = ({ value, signed, tone = "neutral", size = "subhead", short, fitAt, className }) => {
  const v = Math.round(Number(value) || 0);
  const teks = short
    ? `${signed ? (v > 0 ? "+" : v < 0 ? "−" : "") : v < 0 ? "−" : ""}Rp ${rpShort(Math.abs(v))}`
    : signed
    ? rupiahTanda(v)
    : v < 0
    ? `−${rupiah(-v)}`
    : rupiah(v);
  const ukuran = fitAt && teks.length > fitAt ? LEBIH_KECIL[size] : size;
  const nada: Nada = tone === "auto" ? nadaAngka(v) : tone;
  return <span className={cx("tabular-nums whitespace-nowrap", UKURAN[ukuran], TEKS_NADA[nada], className)}>{teks}</span>;
};

/** Titik warna seri (identitas di grafik / legenda). */
export const Dot: React.FC<{ color: string; className?: string }> = ({ color, className }) => (
  <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: color }} />
);

/** Pill kecil berwarna lembut. */
export const Pill: React.FC<{ tone?: Nada; icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ tone = "neutral", icon, children, className }) => (
  <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-caption2 font-semibold [&>svg]:h-3 [&>svg]:w-3", PILL_NADA[tone], className)}>
    {icon}
    {children}
  </span>
);

/** Status hasil: SURPLUS / MINUS / IMBANG — selalu ikon + teks, tidak hanya warna. */
export const StatusPill: React.FC<{ net: number; className?: string }> = ({ net, className }) => {
  const s =
    net > 0
      ? { t: "Surplus", i: <TrendingUp />, n: "positive" as const }
      : net < 0
      ? { t: "Minus", i: <TrendingDown />, n: "negative" as const }
      : { t: "Imbang", i: <Scale />, n: "neutral" as const };
  return (
    <Pill tone={s.n} icon={s.i} className={cx("uppercase tracking-[0.06em]", className)}>
      {s.t}
    </Pill>
  );
};

/**
 * Tile ringkasan di dalam kartu (latar abu lembut, sudut 14px).
 * Bisa diketuk (onClick) — tampil panah kecil di kanan atas.
 */
export const StatTile: React.FC<{
  label: React.ReactNode;
  dot?: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}> = ({ label, dot, icon, value, sub, onClick, ariaLabel, className }) => {
  const isi = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-caption font-medium text-label-2 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">
          {dot && <Dot color={dot} />}
          {icon}
          <span className="truncate">{label}</span>
        </span>
        {onClick && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-label-3" aria-hidden />}
      </div>
      <div className="mt-1 min-w-0 leading-tight">{value}</div>
      {sub && <div className="mt-0.5 truncate text-caption text-label-2">{sub}</div>}
    </>
  );
  const base = cx("min-w-0 rounded-tile bg-surface-2 px-3.5 py-3 text-left", className);
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cx(base, "transition-transform active:scale-[0.98]")}>
      {isi}
    </button>
  ) : (
    <div className={base}>{isi}</div>
  );
};

/** Angka besar di dalam StatTile (bukan rupiah): mis. "42%", "12 hari". */
export const TileValue: React.FC<{ children: React.ReactNode; tone?: Nada }> = ({ children, tone = "neutral" }) => (
  <span className={cx("text-headline font-bold tabular-nums", TEKS_NADA[tone])}>{children}</span>
);

/**
 * Baris batang horizontal (rincian kategori / produk / unit) — gaya Screen Time.
 * `fraction` 0..1 terhadap nilai terbesar; warna batang = makna seri, teks tetap warna teks.
 */
export const BarRow: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  fraction: number;
  color: string;
  sub?: React.ReactNode;
  rank?: number;
  onClick?: () => void;
}> = ({ label, value, fraction, color, sub, rank, onClick }) => {
  const isi = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          {rank !== undefined && <span className="w-4 shrink-0 text-right text-caption font-semibold tabular-nums text-label-3">{rank}</span>}
          <span className="truncate text-subhead font-medium text-label">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-subhead font-semibold tabular-nums text-label">
          {value}
          {onClick && <ChevronRight className="h-4 w-4 text-label-3" aria-hidden />}
        </span>
      </div>
      <div className={cx("mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill", rank !== undefined && "ml-6")}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%`, background: color }} />
      </div>
      {sub && <div className={cx("mt-1 truncate text-caption text-label-2", rank !== undefined && "ml-6")}>{sub}</div>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block w-full text-left transition-opacity active:opacity-50">
      {isi}
    </button>
  ) : (
    <div>{isi}</div>
  );
};

/** Bar kemajuan (utilisasi, rasio). `marker` = garis target 0..1. */
export const Meter: React.FC<{ fraction: number; color: string; marker?: number; className?: string; label?: string }> = ({ fraction, color, marker, className, label }) => (
  <div className={cx("relative h-2 rounded-full bg-fill", className)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
    <div className="h-full rounded-full" style={{ width: `${Math.max(fraction > 0 ? 2 : 0, Math.min(100, fraction * 100))}%`, background: color }} />
    {marker !== undefined && <span aria-hidden className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-label/60" style={{ left: `calc(${Math.min(100, marker * 100)}% - 1px)` }} />}
  </div>
);

/** Batang bertumpuk horizontal (proporsi), celah 2px antar segmen + legenda. */
export const SplitBar: React.FC<{
  segments: { key: string; label: React.ReactNode; value: number; color: string; note?: React.ReactNode }[];
  total?: number;
  ariaLabel?: string;
}> = ({ segments, total, ariaLabel }) => {
  const isi = segments.filter((s) => s.value > 0);
  const basis = Math.max(1, total ?? isi.reduce((a, s) => a + s.value, 0));
  return (
    <div>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-fill" role="img" aria-label={ariaLabel}>
        {isi.map((s) => (
          <div key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / basis) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-caption text-label-2">
            <Dot color={s.color} />
            {s.label}
            {s.note !== undefined && <b className="font-semibold tabular-nums text-label">{s.note}</b>}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Legenda kecil grafik (teks memakai warna teks, warna hanya di titik). */
export const Legend: React.FC<{ items: { color: string; label: string; line?: boolean }[] }> = ({ items }) => (
  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-caption text-label-2">
    {items.map((x) => (
      <span key={x.label} className="inline-flex items-center gap-1.5">
        {x.line ? <span aria-hidden className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: x.color }} /> : <Dot color={x.color} />}
        {x.label}
      </span>
    ))}
  </div>
);
