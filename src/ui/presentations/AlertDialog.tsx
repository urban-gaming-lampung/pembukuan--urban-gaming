import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { cx } from "../foundations/cn";
import { MOTION } from "../foundations/motion";
import type { WarnaIkon } from "../foundations/tokens";
import { IconBadge } from "../surfaces/Card";

export type AlertAction = {
  label: string;
  onClick: () => void;
  role?: "cancel" | "primary" | "destructive";
  disabled?: boolean;
};

/** Dialog konfirmasi / peringatan bergaya iOS 27 & macOS UIAlertController (300px, tombol pill 48px). */
export const AlertDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  dismissible?: boolean;
  zClassName?: string;
  children?: React.ReactNode;
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
  children,
  actions,
}) => {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !dismissible) return;
    // capture + stop: Escape hanya menutup dialog teratas, bukan Sheet di belakangnya
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, dismissible, onClose]);

  if (!open || typeof document === "undefined") return null;

  const horizontal = actions.length === 2;

  return createPortal(
    <div className={cx("fixed inset-0 flex items-center justify-center p-6", zClassName)} role="alertdialog" aria-modal="true">
      <div
        className={cx("absolute inset-0 bg-black/35 dark:bg-black/70 backdrop-blur-[6px]", MOTION.backdrop)}
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        className={cx(
          "relative z-10 w-full max-w-[300px] sm:max-w-[320px] overflow-hidden rounded-sheet apple-sheet p-3.5 shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10",
          MOTION.dialog
        )}
      >
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
          {children && <div className="mt-3 text-left">{children}</div>}
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
                  "flex min-h-[48px] w-full items-center justify-center rounded-full px-4 text-subhead transition active:opacity-75 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
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
