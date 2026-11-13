
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
      className={`grid ${kecil ? "gap-[3px] p-[3px] rounded-[11px]" : "gap-1 p-1 rounded-[14px]"} bg-zinc-200/60 dark:bg-white/10 ${className}`}
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
            className={`${kecil ? "min-h-[30px] px-2.5 py-1 rounded-[8px] text-[11px] font-bold uppercase tracking-wide" : "min-h-[40px] px-1.5 py-1.5 rounded-[10px] text-[12px] sm:text-[13px] font-bold uppercase tracking-wide"} leading-tight transition-all flex items-center justify-center gap-1.5 text-center ${
              aktif
                ? `bg-white dark:bg-[#3a3a3c] shadow-sm ${o.tone || "text-zinc-900 dark:text-white"}`
                : `${o.tone ? `${o.tone} opacity-60` : "text-zinc-500 dark:text-zinc-400"} active:bg-white/50 dark:active:bg-white/5`
            }`}
          >
            <span>{o.label}</span>
            {typeof o.count === "number" && <span className="tabular-nums font-semibold opacity-50">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SubTabs;
