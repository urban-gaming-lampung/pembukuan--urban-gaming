import React from "react";
import { Loader2 } from "lucide-react";
import { cx } from "../foundations/cn";

/**
 * CONTROLS — Tombol kapsul & tombol ikon lingkaran ala Apple iOS 27 & macOS.
 */

export const VARIAN_TOMBOL = {
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

const UKURAN_IKON_TOMBOL = {
  sm: "h-8 w-8 [&>svg]:h-4 [&>svg]:w-4",
  md: "h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]",
  lg: "h-11 w-11 [&>svg]:h-5 [&>svg]:w-5",
} as const;

/** Tombol ala Apple iOS & macOS: filled (aksi utama), tinted, gray, plain, destructive. */
export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof VARIAN_TOMBOL;
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
      VARIAN_TOMBOL[variant],
      UKURAN_TOMBOL[size],
      block && "w-full",
      className
    )}
  >
    {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
    {children}
  </button>
);

/** Tombol ikon lingkaran (SSOT iOS 27 — 32px sm, 36px md, 44px lg). */
export const IconButton: React.FC<
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
    label: string;
    variant?: keyof typeof VARIAN_TOMBOL;
    size?: keyof typeof UKURAN_IKON_TOMBOL;
    loading?: boolean;
    badge?: React.ReactNode;
  }
> = ({ label, variant = "gray", size = "md", loading, badge, disabled, className, children, type = "button", ...rest }) => (
  <button
    type={type}
    aria-label={label}
    title={rest.title ?? label}
    disabled={disabled || loading}
    {...rest}
    className={cx(
      "relative inline-flex shrink-0 select-none items-center justify-center rounded-full transition-all disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-tint/35",
      VARIAN_TOMBOL[variant],
      UKURAN_IKON_TOMBOL[size],
      className
    )}
  >
    {loading ? <Loader2 className="animate-spin" aria-hidden /> : children}
    {badge}
  </button>
);
