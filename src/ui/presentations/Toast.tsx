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

export type NadaToast = keyof typeof TOAST_TONES;

/**
 * Isi kapsul notifikasi (dipakai Toast & PemberitahuanHost). Pesan panjang / banyak baris
 * otomatis jadi kartu bersudut 16px supaya tetap terbaca. Ketuk di mana saja untuk menutup.
 */
export const ToastKapsul: React.FC<{
  message: React.ReactNode;
  tone?: NadaToast;
  icon?: React.ReactNode;
  onClose?: () => void;
  /** Arah animasi masuk: dari atas (notifikasi global) atau dari bawah (default). */
  dari?: "atas" | "bawah";
}> = ({ message, tone = "info", icon, onClose, dari = "bawah" }) => {
  const cfg = TOAST_TONES[tone];
  // > ~38 karakter biasanya turun 2 baris di HP 390px → kartu, bukan kapsul
  const panjang = typeof message === "string" && (message.length > 38 || message.includes("\n"));
  return (
    <div
      role={tone === "negative" || tone === "warning" ? "alert" : "status"}
      aria-live="polite"
      onClick={onClose}
      className={cx(
        "pointer-events-auto flex max-w-md gap-2.5 apple-sheet px-4 py-2.5 shadow-float border ring-1 ring-black/10 dark:ring-white/10",
        panjang ? "items-start rounded-tile" : "items-center rounded-full",
        onClose && "cursor-pointer",
        cfg.ring,
        dari === "atas" ? MOTION.toastTop : MOTION.toast
      )}
    >
      <span aria-hidden className={cx("shrink-0 [&>svg]:h-4 [&>svg]:w-4", panjang && "mt-0.5", cfg.icCls)}>
        {icon ?? cfg.icon}
      </span>
      <div className={cx("min-w-0 flex-1 text-footnote font-semibold text-label", panjang && "whitespace-pre-line")}>{message}</div>
      {onClose && (
        <span aria-hidden className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-label-3">
          <X className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
};

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
      <ToastKapsul message={message} tone={tone} icon={icon} onClose={onClose} dari={position === "top" ? "atas" : "bawah"} />
    </div>,
    document.body
  );
};
