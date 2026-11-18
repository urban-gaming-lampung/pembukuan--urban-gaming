import React from "react";
import { AlertTriangle, Info, Loader2, XCircle } from "lucide-react";
import { cx } from "../foundations/cn";
import { kartu } from "../surfaces/Card";

/**
 * FEEDBACK — Keadaan kosong, catatan peringatan, catatan kaki, dan pemuat (Spinner).
 */

/** Keadaan kosong resmi Apple iOS 27: ikon dalam lingkaran (50×50) + judul tebal + penjelasan singkat. */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ icon, title, children, className }) => (
  <div className={cx(kartu, "px-6 py-10 text-center", className)}>
    {icon && (
      <div className="mx-auto mb-3 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-fill text-label-3 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </div>
    )}
    <div className="text-title3 font-bold tracking-tight text-label">{title}</div>
    {children && <div className="mx-auto mt-1 max-w-sm text-footnote text-label-2">{children}</div>}
  </div>
);

const NADA_CATATAN = {
  info: {
    icon: <Info />,
    cls: "bg-tint/[0.11] ring-1 ring-inset ring-tint/[0.18] dark:bg-tint/[0.18] dark:ring-tint/[0.28]",
    ic: "text-tint",
  },
  warning: {
    icon: <AlertTriangle />,
    cls: "bg-warning/[0.12] ring-1 ring-inset ring-warning/[0.20] dark:bg-warning/[0.18] dark:ring-warning/[0.28]",
    ic: "text-warning",
  },
  negative: {
    icon: <XCircle />,
    cls: "bg-negative/[0.11] ring-1 ring-inset ring-negative/[0.18] dark:bg-negative/[0.18] dark:ring-negative/[0.28]",
    ic: "text-negative",
  },
} as const;

/** Catatan / peringatan di dalam atau di antara kartu. Teks memakai warna teks, ikon memakai warna nada. */
export const Notice: React.FC<{
  tone?: keyof typeof NADA_CATATAN;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = "info", children, className }) => {
  const n = NADA_CATATAN[tone];
  return (
    <div
      role={tone === "info" ? "note" : "alert"}
      className={cx(
        "flex items-start gap-2.5 rounded-tile px-3.5 sm:px-4 py-3 text-footnote text-label backdrop-blur-md",
        n.cls,
        className
      )}
    >
      <span className={cx("mt-px shrink-0 [&>svg]:h-4 [&>svg]:w-4", n.ic)}>{n.icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/** Catatan kaki halaman (penjelasan cara hitung). */
export const Footnote: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cx("px-4 text-caption leading-relaxed text-label-2", className)}>{children}</p>
);

const UKURAN_SPINNER = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

/** Indikator proses / muat standar. */
export const Spinner: React.FC<{
  size?: keyof typeof UKURAN_SPINNER;
  label?: string;
  className?: string;
}> = ({ size = "md", label, className }) => (
  <span role="status" className={cx("inline-flex items-center gap-2 text-label-2", className)}>
    <Loader2 className={cx("animate-spin text-tint", UKURAN_SPINNER[size])} aria-hidden />
    {label && <span className="text-footnote font-medium">{label}</span>}
  </span>
);
