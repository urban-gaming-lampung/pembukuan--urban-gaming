import React from "react";
import { AlertTriangle, Info, Search, X, XCircle } from "lucide-react";
import { kartu } from "./layout";

/**
 * UMPAN BALIK & KONTROL — keadaan kosong, catatan, tombol, kolom cari.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Keadaan kosong: ikon samar + judul + penjelasan singkat. */
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; className?: string }> = ({ icon, title, children, className }) => (
  <div className={cx(kartu, "px-6 py-8 text-center", className)}>
    {icon && <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center text-label-3 [&>svg]:h-8 [&>svg]:w-8">{icon}</div>}
    <div className="text-headline text-label">{title}</div>
    {children && <p className="mx-auto mt-1 max-w-sm text-footnote text-label-2">{children}</p>}
  </div>
);

const NADA_CATATAN = {
  info: { icon: <Info />, cls: "bg-tint/10 dark:bg-tint/15", ic: "text-tint" },
  warning: { icon: <AlertTriangle />, cls: "bg-warning/10 dark:bg-warning/15", ic: "text-warning" },
  negative: { icon: <XCircle />, cls: "bg-negative/10 dark:bg-negative/15", ic: "text-negative" },
} as const;

/** Catatan / peringatan di dalam atau di antara kartu. Teks memakai warna teks, ikon memakai warna nada. */
export const Notice: React.FC<{ tone?: keyof typeof NADA_CATATAN; children: React.ReactNode; className?: string }> = ({ tone = "info", children, className }) => {
  const n = NADA_CATATAN[tone];
  return (
    <div role={tone === "info" ? "note" : "alert"} className={cx("flex items-start gap-2.5 rounded-tile px-3.5 py-3 text-footnote text-label", n.cls, className)}>
      <span className={cx("mt-px shrink-0 [&>svg]:h-4 [&>svg]:w-4", n.ic)}>{n.icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/** Catatan kaki halaman (penjelasan cara hitung). */
export const Footnote: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cx("px-4 text-caption leading-relaxed text-label-2", className)}>{children}</p>
);

const VARIAN = {
  filled: "bg-tint text-white active:opacity-80",
  tinted: "bg-tint/10 text-tint dark:bg-tint/15 active:opacity-70",
  gray: "bg-fill text-label active:opacity-70",
  plain: "text-tint active:opacity-50",
  destructive: "bg-negative/10 text-negative dark:bg-negative/15 active:opacity-70",
} as const;
const UKURAN_TOMBOL = {
  lg: "h-[50px] rounded-tile px-5 text-headline",
  md: "h-11 rounded-field px-4 text-subhead font-semibold",
  sm: "h-8 rounded-full px-3 text-footnote font-semibold",
} as const;

/** Tombol ala iOS: filled (aksi utama), tinted, gray, plain, destructive. */
export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIAN; size?: keyof typeof UKURAN_TOMBOL; icon?: React.ReactNode; block?: boolean }
> = ({ variant = "filled", size = "md", icon, block, className, children, type = "button", ...rest }) => (
  <button
    type={type}
    {...rest}
    className={cx(
      "inline-flex select-none items-center justify-center gap-1.5 transition-opacity disabled:opacity-40 [&>svg]:h-4 [&>svg]:w-4",
      VARIAN[variant],
      UKURAN_TOMBOL[size],
      block && "w-full",
      className
    )}
  >
    {icon}
    {children}
  </button>
);

/** Kolom cari ala iOS (latar abu, ikon kaca pembesar, tombol hapus). */
export const SearchField: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder = "Cari", className }) => (
  <label className={cx("flex h-10 items-center gap-2 rounded-field bg-fill px-3", className)}>
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
      <button type="button" onClick={() => onChange("")} aria-label="Hapus pencarian" className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full text-label-3">
        <X className="h-4 w-4" />
      </button>
    )}
  </label>
);

/** Saklar ala iOS (51×31). Hijau sistem saat aktif. */
export const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({ on, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={cx("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-[#34C759]" : "bg-[#E9E9EA] dark:bg-[#39393D]")}
  >
    <span className={cx("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-all", on ? "left-[22px]" : "left-[2px]")} />
  </button>
);
