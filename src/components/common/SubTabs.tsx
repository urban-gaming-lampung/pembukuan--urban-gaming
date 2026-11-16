
import React from "react";

export type SubTabOption<T extends string> = {
  key: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  /** Warna teks khusus (mis. merah untuk Pengeluaran, hijau untuk Pemasukan) */
  tone?: string;
};

/**
 * SATU-SATUNYA gaya segmented control (SSOT, Design System src/ui).
 * - size "md" (bawaan): tab sub-halaman, label HURUF BESAR — Input, Transaksi, Stok Jualan (Baru / Seken),
 *   Analitik, Pegawai, Update Stok.
 * - size "sm": pilihan kecil di dalam kartu (mis. urutkan Jumlah / Omzet).
 * Semua label tab SELALU HURUF BESAR (aturan Design System) supaya selaras di semua halaman.
 */
function SubTabs<T extends string>({
  value,
  onChange,
  options,
  className = "",
  ariaLabel,
  size = "md",
}: {
  value: T;
  onChange: (k: T) => void;
  options: SubTabOption<T>[];
  className?: string;
  ariaLabel?: string;
  size?: "md" | "sm";
}) {
  const kecil = size === "sm";
  const padat = !kecil && options.length >= 5;
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`grid ${kecil ? "gap-[3px] p-[3px] rounded-full" : "gap-1 p-1 rounded-full"} apple-segmented ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const aktif = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={aktif}
            onClick={() => onChange(o.key)}
            className={`${kecil ? "min-h-[34px] px-3 py-1.5 rounded-full text-caption font-bold uppercase tracking-wide" : `min-h-[44px] ${padat ? "px-1.5 sm:px-3.5" : "px-2.5 sm:px-3.5"} py-1.5 rounded-full text-[11px] sm:text-footnote font-bold uppercase tracking-normal sm:tracking-wide`} leading-tight whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint ${
              aktif
                ? `apple-segmented-thumb ${o.tone || "text-label"}`
                : `${o.tone ? `${o.tone} opacity-65 hover:opacity-90` : "text-label-2 hover:text-label"} hover:bg-white/35 dark:hover:bg-white/[0.06] active:bg-white/50 dark:active:bg-white/[0.10]`
            }`}
          >
            {o.icon && <span aria-hidden className="[&>svg]:h-3.5 [&>svg]:w-3.5 shrink-0">{o.icon}</span>}
            <span className="truncate">{o.label}</span>
            {typeof o.count === "number" && <span className="tabular-nums font-semibold opacity-55">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SubTabs;
