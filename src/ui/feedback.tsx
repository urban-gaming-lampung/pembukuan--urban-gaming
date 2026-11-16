import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, Loader2, Search, X, XCircle } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { IconBadge, kartu } from "./layout";
import type { WarnaIkon } from "./tokens";

/**
 * UMPAN BALIK & KONTROL — keadaan kosong, catatan, tombol, kolom cari.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Keadaan kosong resmi Apple iOS 27: ikon dalam lingkaran (50×50) + judul tebal + penjelasan singkat. */
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; className?: string }> = ({ icon, title, children, className }) => (
  <div className={cx(kartu, "px-6 py-10 text-center", className)}>
    {icon && (
      <div className="mx-auto mb-3 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-fill text-label-3 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </div>
    )}
    <div className="text-title3 font-bold tracking-tight text-label">{title}</div>
    {children && <p className="mx-auto mt-1 max-w-sm text-footnote text-label-2">{children}</p>}
  </div>
);

const NADA_CATATAN = {
  info: { icon: <Info />, cls: "bg-tint/[0.11] ring-1 ring-inset ring-tint/[0.18] dark:bg-tint/[0.18] dark:ring-tint/[0.28]", ic: "text-tint" },
  warning: { icon: <AlertTriangle />, cls: "bg-warning/[0.12] ring-1 ring-inset ring-warning/[0.20] dark:bg-warning/[0.18] dark:ring-warning/[0.28]", ic: "text-warning" },
  negative: { icon: <XCircle />, cls: "bg-negative/[0.11] ring-1 ring-inset ring-negative/[0.18] dark:bg-negative/[0.18] dark:ring-negative/[0.28]", ic: "text-negative" },
} as const;

/** Catatan / peringatan di dalam atau di antara kartu. Teks memakai warna teks, ikon memakai warna nada. */
export const Notice: React.FC<{ tone?: keyof typeof NADA_CATATAN; children: React.ReactNode; className?: string }> = ({ tone = "info", children, className }) => {
  const n = NADA_CATATAN[tone];
  return (
    <div role={tone === "info" ? "note" : "alert"} className={cx("flex items-start gap-2.5 rounded-tile px-3.5 sm:px-4 py-3 text-footnote text-label backdrop-blur-md", n.cls, className)}>
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
  filled: "bg-action text-action-label shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:opacity-85 active:opacity-75",
  tinted: "bg-action/[0.08] text-action dark:bg-action/[0.15] hover:bg-action/[0.13] dark:hover:bg-action/[0.22] active:opacity-75",
  gray: "bg-fill text-label hover:brightness-[0.95] dark:hover:brightness-115 active:opacity-70",
  plain: "text-label hover:bg-fill/70 active:opacity-60",
  destructive: "bg-negative/[0.12] text-negative dark:bg-negative/[0.20] hover:bg-negative/[0.18] dark:hover:bg-negative/[0.28] active:opacity-75",
} as const;
const UKURAN_TOMBOL = {
  lg: "h-[50px] rounded-full px-5 text-headline",
  md: "h-11 rounded-full px-4 text-subhead font-semibold",
  sm: "h-8 rounded-full px-3 text-footnote font-semibold",
} as const;

/** Tombol ala Apple iOS & macOS: filled (aksi utama), tinted, gray, plain, destructive. */
export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof VARIAN;
    size?: keyof typeof UKURAN_TOMBOL;
    icon?: React.ReactNode;
    loading?: boolean;
    block?: boolean;
  }
> = ({ variant = "filled", size = "md", icon, loading, block, disabled, className, children, type = "button", ...rest }) => (
  <button
    type={type}
    disabled={disabled || loading}
    {...rest}
    className={cx(
      "inline-flex select-none items-center justify-center gap-1.5 transition-all disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-tint/35 [&>svg]:h-4 [&>svg]:w-4",
      VARIAN[variant],
      UKURAN_TOMBOL[size],
      block && "w-full",
      className
    )}
  >
    {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
    {children}
  </button>
);

/** Kolom cari ala iOS 27 & macOS (kapsul frosted, cincin fokus biru sistem, tombol hapus). */
export const SearchField: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder = "Cari", className }) => (
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
      <button type="button" onClick={() => onChange("")} aria-label="Hapus pencarian" className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full text-label-3 hover:text-label">
        <X className="h-4 w-4" />
      </button>
    )}
  </label>
);

/** Saklar resmi Apple iOS 27 (track 64×28, pill knob 38×24). Hijau sistem saat aktif. */
export const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({ on, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={cx(
      "group relative h-[28px] w-[64px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-tint/35",
      on ? "bg-[#34C759] dark:bg-[#30D158]" : "bg-[#3C3C43]/30 dark:bg-[#EBEBF5]/30"
    )}
  >
    <span
      className={cx(
        "absolute top-[2px] h-[24px] w-[38px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.16),0_1px_1px_rgba(0,0,0,0.12)] transition-all duration-200 group-active:scale-[1.06] motion-reduce:transition-none",
        on ? "left-[24px]" : "left-[2px]"
      )}
    />
  </button>
);

const LEBAR_SHEET = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[720px]",
  xl: "sm:max-w-[960px]",
} as const;

/**
 * Lembar adaptif Apple:
 * - Mobile (< sm): Bottom Sheet dari bawah dengan grabber 36×5px.
 * - Desktop / macOS (sm+): Sheet terpusat dengan titlebar translucent & tombol Esc.
 */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof LEBAR_SHEET;
  variant?: "grouped" | "surface";
  zClassName?: string;
  children: React.ReactNode;
}> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconColor = "blue",
  headerLeft,
  headerRight,
  footer,
  size = "md",
  variant = "grouped",
  zClassName = "z-[250]",
  children,
}) => {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={cx("fixed inset-0 flex items-end justify-center sm:items-center sm:p-6", zClassName)} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-[8px] transition-opacity" onClick={onClose} aria-hidden />
      <div
        className={cx(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-sheet shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10 sm:max-h-[86vh] sm:rounded-[32px]",
          "animate-in slide-in-from-bottom-4 duration-200 sm:zoom-in-95",
          variant === "grouped"
            ? "apple-sheet-grouped"
            : "apple-sheet",
          LEBAR_SHEET[size]
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
          <div className="h-[5px] w-9 rounded-full bg-label-3/50" />
        </div>

        {(title || headerLeft || headerRight) && (
          <header className="apple-bar flex shrink-0 items-center justify-between gap-3 border-b border-sep px-4 sm:px-5 py-3.5">
            {headerLeft ? (
              <div className="shrink-0">{headerLeft}</div>
            ) : icon ? (
              <IconBadge color={iconColor}>{icon}</IconBadge>
            ) : null}

            <div className="min-w-0 flex-1">
              {title && <h3 className="truncate text-headline text-label">{title}</h3>}
              {subtitle && <p className="truncate text-caption text-label-2">{subtitle}</p>}
            </div>

            {headerRight ?? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 transition-colors hover:text-label active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 sm:py-5">{children}</div>

        {footer && (
          <footer className="apple-bar shrink-0 border-t border-sep px-4 sm:px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
};

export type AlertAction = {
  label: string;
  onClick: () => void;
  role?: "cancel" | "primary" | "destructive";
  disabled?: boolean;
};

/** Dialog konfirmasi / peringatan bergaya iOS & macOS UIAlertController. */
export const AlertDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  dismissible?: boolean;
  zClassName?: string;
  actions: AlertAction[];
}> = ({
  open,
  onClose,
  title,
  description,
  icon,
  iconColor = "blue",
  dismissible = true,
  zClassName = "z-[270]",
  actions,
}) => {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!open || typeof document === "undefined") return null;

  const horizontal = actions.length === 2;

  return createPortal(
    <div className={cx("fixed inset-0 flex items-center justify-center p-6", zClassName)} role="alertdialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/35 dark:bg-black/70 backdrop-blur-[6px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-[300px] sm:max-w-[320px] overflow-hidden rounded-sheet apple-sheet p-3.5 shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200">
        <div className="px-2 pt-2 pb-4 text-center">
          {icon && (
            <div className="mb-3 flex justify-center">
              <IconBadge color={iconColor} variant="tinted" className="h-10 w-10 rounded-[12px] [&>svg]:h-5 [&>svg]:w-5">
                {icon}
              </IconBadge>
            </div>
          )}
          <h3 className="text-headline text-label">{title}</h3>
          {description && <div className="mt-1.5 text-footnote leading-relaxed text-label-2">{description}</div>}
        </div>

        <div className={cx(horizontal ? "grid grid-cols-2 gap-2.5" : "flex flex-col gap-2.5")}>
          {actions.map((a, idx) => {
            const roleCls =
              a.role === "destructive"
                ? "bg-negative/[0.13] text-negative dark:bg-negative/[0.22] font-medium hover:bg-negative/[0.20] dark:hover:bg-negative/[0.30]"
                : a.role === "primary"
                ? "bg-action text-action-label font-semibold shadow-sm hover:opacity-85"
                : "bg-fill text-label font-medium hover:brightness-95 dark:hover:brightness-115";
            return (
              <button
                key={idx}
                type="button"
                disabled={a.disabled}
                onClick={a.onClick}
                className={cx(
                  "flex min-h-[48px] w-full items-center justify-center rounded-full px-4 text-subhead transition-all active:opacity-75 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                  roleCls
                )}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
