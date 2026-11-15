
export type SubTabOption<T extends string> = {
  key: T;
  label: string;
  count?: number;
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
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`grid ${kecil ? "gap-[3px] p-[3px] rounded-field" : "gap-1 p-1 rounded-tile"} bg-fill ${className}`}
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
            className={`${kecil ? "min-h-[32px] px-2.5 py-1 rounded-control text-caption2 font-bold uppercase tracking-wide" : "min-h-[44px] px-2 py-1.5 rounded-control text-caption sm:text-footnote font-bold uppercase tracking-wide"} leading-tight transition-all flex items-center justify-center gap-1.5 text-center ${
              aktif
                ? `bg-surface shadow-sm ${o.tone || "text-label"}`
                : `${o.tone ? `${o.tone} opacity-60` : "text-label-2"} active:bg-surface/50`
            }`}
          >
            <span>{o.label}</span>
            {typeof o.count === "number" && <span className="tabular-nums font-semibold opacity-55">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SubTabs;
