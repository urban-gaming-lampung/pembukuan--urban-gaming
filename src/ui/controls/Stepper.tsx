import React from "react";
import { Minus, Plus } from "lucide-react";
import { cx } from "../foundations/cn";

/**
 * STEPPER — Kontrol tambah-kurang ala Apple iOS 27 (tinggi 32px/36px, kapsul kaca + angka tabular).
 */
export const Stepper: React.FC<{
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  formatValue?: (v: number) => React.ReactNode;
  hideValue?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}> = ({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  disabled = false,
  formatValue,
  hideValue = false,
  size = "md",
  ariaLabel = "Ubah jumlah",
  className,
}) => {
  const canDec = !disabled && value - step >= min;
  const canInc = !disabled && value + step <= max;
  const btnCls =
    size === "sm"
      ? "hit-44 h-7 w-7 [&>svg]:h-3.5 [&>svg]:w-3.5"
      : "hit-44 h-8 w-8 [&>svg]:h-4 [&>svg]:w-4";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx(
        "inline-flex shrink-0 items-center rounded-full bg-fill p-0.5 ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06] select-none",
        disabled && "opacity-45",
        className
      )}
    >
      <button
        type="button"
        aria-label={`Kurangi ${ariaLabel}`}
        disabled={!canDec}
        onClick={() => canDec && onChange(Math.max(min, value - step))}
        className={cx(
          "inline-flex items-center justify-center rounded-full text-label transition hover:bg-surface active:scale-95 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
          btnCls
        )}
      >
        <Minus />
      </button>
      {!hideValue && (
        <span className="min-w-[2.25rem] px-1.5 text-center text-subhead font-bold tabular-nums text-label">
          {formatValue ? formatValue(value) : value}
        </span>
      )}
      <button
        type="button"
        aria-label={`Tambah ${ariaLabel}`}
        disabled={!canInc}
        onClick={() => canInc && onChange(Math.min(max, value + step))}
        className={cx(
          "inline-flex items-center justify-center rounded-full text-label transition hover:bg-surface active:scale-95 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
          btnCls
        )}
      >
        <Plus />
      </button>
    </div>
  );
};
