
export type SubTabOption<T extends string> = { key: T; label: string; count?: number };

/**
 * SATU-SATUNYA gaya tab sub-halaman (SSOT): segmented control ala iOS, label HURUF BESAR.
 * Dipakai di Input, Transaksi, Stok Jualan (Baru / Seken), Analitik, Pegawai, Update Stok.
 */
function SubTabs<T extends string>({
  value,
  onChange,
  options,
  className = "",
  ariaLabel,
}: {
  value: T;
  onChange: (k: T) => void;
  options: SubTabOption<T>[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`grid gap-1 p-1 rounded-[14px] bg-zinc-200/60 dark:bg-white/10 ${className}`}
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
            className={`min-h-[40px] px-1.5 py-1.5 rounded-[10px] text-[12px] sm:text-[13px] font-bold uppercase tracking-wide leading-tight transition-all flex items-center justify-center gap-1.5 text-center ${
              aktif ? "bg-white dark:bg-[#3a3a3c] text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 active:bg-white/50 dark:active:bg-white/5"
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
