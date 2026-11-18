import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cx } from "../foundations/cn";
import { MOTION } from "../foundations/motion";

const TOAST_TONES = {
  info: {
    icon: <Info />,
    icCls: "text-tint",
    ring: "border-white/60 dark:border-white/[0.15]",
  },
  positive: {
    icon: <CheckCircle2 />,
    icCls: "text-positive",
    ring: "border-positive/30 dark:border-positive/35",
  },
  warning: {
    icon: <AlertTriangle />,
    icCls: "text-warning",
    ring: "border-warning/30 dark:border-warning/35",
  },
  negative: {
    icon: <XCircle />,
    icCls: "text-negative",
    ring: "border-negative/30 dark:border-negative/35",
  },
} as const;

/**
 * Kapsul notifikasi mengambang bergaya iOS 27 Dynamic Pill / Liquid Glass Toast.
 */
export const Toast: React.FC<{
  open: boolean;
  message: React.ReactNode;
  tone?: keyof typeof TOAST_TONES;
  icon?: React.ReactNode;
  onClose?: () => void;
  durationMs?: number;
  position?: "bottom" | "top";
  zClassName?: string;
}> = ({
  open,
  message,
  tone = "info",
  icon,
  onClose,
  durationMs,
  position = "bottom",
  zClassName = "z-[320]",
}) => {
  useEffect(() => {
    if (!open || !durationMs || !onClose) return;
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open || typeof document === "undefined") return null;

  const cfg = TOAST_TONES[tone];

  return createPortal(
    <div
      className={cx(
        "pointer-events-none fixed inset-x-0 flex justify-center px-4",
        position === "top"
          ? "top-[max(16px,env(safe-area-inset-top))]"
          : "bottom-[max(96px,calc(env(safe-area-inset-bottom)+24px))] md:bottom-8",
        zClassName
      )}
    >
      <div
        role={tone === "negative" || tone === "warning" ? "alert" : "status"}
        aria-live="polite"
        className={cx(
          "pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full apple-glass px-4 py-2.5 shadow-float border ring-1 ring-black/10 dark:ring-white/10",
          cfg.ring,
          MOTION.toast
        )}
      >
        <span aria-hidden className={cx("shrink-0 [&>svg]:h-4 [&>svg]:w-4", cfg.icCls)}>
          {icon ?? cfg.icon}
        </span>
        <div className="min-w-0 text-footnote font-semibold text-label">{message}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup notifikasi"
            className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-label-3 transition-colors hover:bg-fill hover:text-label"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};
