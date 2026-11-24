import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { cx } from "../foundations/cn";
import { MOTION } from "../foundations/motion";
import type { WarnaIkon } from "../foundations/tokens";
import { IconBadge } from "../surfaces/Card";

const LEBAR_SHEET = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[720px]",
  xl: "sm:max-w-[960px]",
} as const;

/**
 * Lembar adaptif Apple (SSOT):
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
  /** Sembunyikan tombol X bawaan hanya jika lembar tidak boleh ditutup langsung */
  hideClose?: boolean;
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
  hideClose = false,
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
      <div className={cx("absolute inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-[8px]", MOTION.backdrop)} onClick={onClose} aria-hidden />
      <div
        className={cx(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-sheet shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10 sm:max-h-[86vh] sm:rounded-[32px]",
          MOTION.sheet,
          variant === "grouped" ? "apple-sheet-grouped" : "apple-sheet",
          LEBAR_SHEET[size]
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
          <div className="h-[5px] w-9 rounded-full bg-label-3/50" />
        </div>

        {(title || subtitle || icon || headerLeft || headerRight || !hideClose) && (
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

            <div className="flex shrink-0 items-center gap-2">
              {headerRight}
              {!hideClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup"
                  className="flex hit-44 h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 transition-[color,transform,opacity] hover:text-label active:scale-95 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
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
