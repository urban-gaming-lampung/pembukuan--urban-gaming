import React from "react";
import { Search, X } from "lucide-react";
import { cx } from "../foundations/cn";

/** Kolom cari ala iOS 27 & macOS (kapsul frosted, cincin fokus biru sistem, tombol hapus). */
export const SearchField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = "Cari", className }) => (
  <label
    className={cx(
      "flex h-11 items-center gap-2 rounded-full bg-fill px-3.5 transition-all focus-within:bg-surface focus-within:ring-2 focus-within:ring-tint/35",
      className
    )}
  >
    <Search className="h-4 w-4 shrink-0 text-label-2" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="min-w-0 flex-1 bg-transparent text-[16px] text-label placeholder:text-label-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange("")}
        aria-label="Hapus pencarian"
        className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full text-label-3 hover:text-label"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </label>
);
