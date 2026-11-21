import React from "react";
import { ChevronRight, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { rpShort, rupiah, rupiahTanda } from "../../lib/format";
import { cx } from "../foundations/cn";
import { AKSEN_TILE, nadaAngka, PILL_NADA, TEKS_NADA, type Nada, type WarnaIkon } from "../foundations/tokens";

/**
 * DATA — Nominal rupiah, tile ringkasan, pill status, batang proporsi, dan meter.
 */

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

const LEBIH_KECIL: Record<UkuranAngka, UkuranAngka> = {
  display: "title1",
  title1: "title2",
  title2: "title3",
  title3: "headline",
  headline: "subhead",
  subhead: "footnote",
  footnote: "footnote",
};

/** Nominal rupiah dengan dukungan format ringkas, tanda +/−, dan adaptasi ukuran layar. */
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

/** Pill kecil berwarna lembut (`tone` untuk status makna, `color` untuk identitas kategori). */
export const Pill: React.FC<{
  tone?: Nada;
  color?: WarnaIkon;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = "neutral", color, icon, children, className }) => (
  <span
    className={cx(
      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-caption2 font-semibold [&>svg]:h-3 [&>svg]:w-3",
      color ? AKSEN_TILE[color].pill : PILL_NADA[tone],
      className
    )}
  >
    {icon}
    {children}
  </span>
);

/** Status hasil: SURPLUS / MINUS / IMBANG — selalu ikon + teks. */
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

/** Tile ringkasan di dalam kartu (sudut 16px — frosted glass nested pane). */
export const StatTile: React.FC<{
  label: React.ReactNode;
  dot?: string;
  icon?: React.ReactNode;
  accent?: WarnaIkon;
  badge?: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  progress?: number;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}> = ({ label, dot, icon, accent, badge, value, sub, progress, onClick, ariaLabel, className }) => {
  const gaya = accent ? AKSEN_TILE[accent] : undefined;
  const isi = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-caption font-semibold text-label-2">
          {dot && <Dot color={dot} />}
          {icon &&
            (gaya ? (
              <span aria-hidden className={cx("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] [&>svg]:h-3 [&>svg]:w-3", gaya.iconBg, gaya.iconText)}>
                {icon}
              </span>
            ) : (
              <span aria-hidden className="inline-flex shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
                {icon}
              </span>
            ))}
          <span className={cx("truncate", gaya && accent !== "gray" && "font-semibold")}>{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {badge}
          {onClick && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-label-3" aria-hidden />}
        </span>
      </div>
      <div className="mt-2 min-w-0 leading-tight">{value}</div>
      {sub && <div className="mt-1 truncate text-caption text-label-2">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.max(progress > 0 ? 4 : 0, Math.min(100, progress * 100))}%`, background: gaya ? gaya.bar : "#0088FF" }}
          />
        </div>
      )}
    </>
  );
  const base = cx(
    "min-w-0 rounded-tile px-3.5 sm:px-4 py-3 sm:py-3.5 text-left transition-[transform,opacity,background-color] duration-150",
    gaya ? gaya.bg : cx("apple-tile ring-1 ring-black/[0.03] dark:ring-white/[0.03]", onClick && "apple-tile-interactive"),
    className
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        base,
        gaya
          ? "hover:brightness-[0.97] dark:hover:brightness-110 active:scale-[0.98]"
          : "active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint"
      )}
    >
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

/** Baris batang horizontal (rincian kategori / produk / unit) — gaya Screen Time. */
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
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%`, background: color }}
        />
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
/** Bar kemajuan. `size="sm"` = 4px (Progress Indicator iOS 27 di baris daftar), `md` = 8px. */
export const Meter: React.FC<{ fraction: number; color: string; marker?: number; className?: string; label?: string; size?: "sm" | "md" }> = ({ fraction, color, marker, className, label, size = "md" }) => (
  <div className={cx("relative rounded-full bg-fill", size === "sm" ? "h-1" : "h-2", className)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
    <div
      className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
      style={{ width: `${Math.max(fraction > 0 ? 2 : 0, Math.min(100, fraction * 100))}%`, background: color }}
    />
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
