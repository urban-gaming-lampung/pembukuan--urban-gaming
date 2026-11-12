import React from "react";
import type { Kondisi } from "../lib/posSales";

/** Saklar Baru / Seken (gaya segmented control iOS) — dipakai POS, Input Stok, menu Stok. */
const KondisiSwitch: React.FC<{
  value: Kondisi;
  onChange: (k: Kondisi) => void;
  counts?: Partial<Record<Kondisi, number>>;
  size?: "md" | "sm";
  className?: string;
}> = ({ value, onChange, counts, size = "md", className = "" }) => (
  <div role="tablist" aria-label="Kondisi barang" className={`grid grid-cols-2 gap-1 p-1 rounded-[12px] bg-zinc-200/70 dark:bg-white/10 ${className}`}>
    {(["BARU", "SEKEN"] as const).map((k) => (
      <button
        key={k}
        type="button"
        role="tab"
        aria-selected={value === k}
        onClick={() => onChange(k)}
        className={`${size === "sm" ? "h-8 text-[13px]" : "h-9 text-[14px]"} rounded-[9px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
          value === k ? "bg-white dark:bg-[#3a3a3c] text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {k === "BARU" ? "Baru" : "Seken"}
        {typeof counts?.[k] === "number" && <span className="tabular-nums opacity-50 font-medium">{counts[k]}</span>}
      </button>
    ))}
  </div>
);

export default KondisiSwitch;
