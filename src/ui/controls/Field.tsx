import React from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../foundations/cn";

/**
 * FIELD — Input teks, pilih dropdown, dan area teks standar Apple iOS 27 (44px compact / 52px prominent).
 * Menggunakan font 16px agar Safari iOS tidak melakukan zoom otomatis saat fokus.
 */

export const FieldLabel: React.FC<{
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ htmlFor, required, children, className }) => (
  <label
    htmlFor={htmlFor}
    className={cx("mb-1.5 block text-caption font-semibold uppercase tracking-[0.06em] text-label-2", className)}
  >
    {children}
    {required && <span className="ml-0.5 text-negative">*</span>}
  </label>
);

const FIELD_HEIGHT = {
  md: "h-11",
  lg: "h-[52px]",
} as const;

export const TextField: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
    label?: React.ReactNode;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    required?: boolean;
    size?: keyof typeof FIELD_HEIGHT;
    leftIcon?: React.ReactNode;
    rightElement?: React.ReactNode;
    wrapperClassName?: string;
    inputClassName?: string;
  }
> = ({
  id,
  label,
  hint,
  error,
  required,
  size = "md",
  leftIcon,
  rightElement,
  wrapperClassName,
  inputClassName,
  className,
  ...rest
}) => {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cx("min-w-0", wrapperClassName)}>
      {label && (
        <FieldLabel htmlFor={fieldId} required={required}>
          {label}
        </FieldLabel>
      )}
      <div
        className={cx(
          "flex items-center gap-2 rounded-field bg-fill px-3.5 ring-1 ring-inset transition-all",
          FIELD_HEIGHT[size],
          error
            ? "ring-negative/60 focus-within:bg-surface focus-within:ring-2 focus-within:ring-negative/50"
            : "ring-edge/70 focus-within:bg-surface focus-within:ring-2 focus-within:ring-tint/40",
          rest.disabled && "opacity-50",
          className
        )}
      >
        {leftIcon && <span aria-hidden className="shrink-0 text-label-2 [&>svg]:h-4 [&>svg]:w-4">{leftIcon}</span>}
        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          {...rest}
          className={cx(
            "min-w-0 flex-1 bg-transparent text-[16px] sm:text-callout text-label placeholder:text-label-3 focus:outline-none disabled:cursor-not-allowed",
            inputClassName
          )}
        />
        {rightElement && <div className="shrink-0">{rightElement}</div>}
      </div>
      {error ? (
        <p className="mt-1 text-caption font-medium text-negative">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-caption text-label-2">{hint}</p>
      ) : null}
    </div>
  );
};

export const SelectField: React.FC<
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
    label?: React.ReactNode;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    required?: boolean;
    size?: keyof typeof FIELD_HEIGHT;
    wrapperClassName?: string;
    selectClassName?: string;
  }
> = ({
  id,
  label,
  hint,
  error,
  required,
  size = "md",
  wrapperClassName,
  selectClassName,
  className,
  children,
  ...rest
}) => {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cx("min-w-0", wrapperClassName)}>
      {label && (
        <FieldLabel htmlFor={fieldId} required={required}>
          {label}
        </FieldLabel>
      )}
      <div
        className={cx(
          "relative flex items-center rounded-field bg-fill ring-1 ring-inset transition-all",
          FIELD_HEIGHT[size],
          error
            ? "ring-negative/60 focus-within:bg-surface focus-within:ring-2 focus-within:ring-negative/50"
            : "ring-edge/70 focus-within:bg-surface focus-within:ring-2 focus-within:ring-tint/40",
          rest.disabled && "opacity-50",
          className
        )}
      >
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          {...rest}
          className={cx(
            "h-full w-full appearance-none bg-transparent pl-3.5 pr-9 text-[16px] sm:text-callout font-medium text-label focus:outline-none disabled:cursor-not-allowed",
            selectClassName
          )}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 h-4 w-4 text-label-2"
        />
      </div>
      {error ? (
        <p className="mt-1 text-caption font-medium text-negative">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-caption text-label-2">{hint}</p>
      ) : null}
    </div>
  );
};

export const TextAreaField: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: React.ReactNode;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    required?: boolean;
    wrapperClassName?: string;
    textareaClassName?: string;
  }
> = ({
  id,
  label,
  hint,
  error,
  required,
  wrapperClassName,
  textareaClassName,
  className,
  rows = 3,
  ...rest
}) => {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cx("min-w-0", wrapperClassName)}>
      {label && (
        <FieldLabel htmlFor={fieldId} required={required}>
          {label}
        </FieldLabel>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={cx(
          "w-full rounded-field bg-fill px-3.5 py-2.5 text-[16px] sm:text-callout text-label placeholder:text-label-3 ring-1 ring-inset transition-all focus:bg-surface focus:outline-none focus:ring-2 disabled:opacity-50",
          error ? "ring-negative/60 focus:ring-negative/50" : "ring-edge/70 focus:ring-tint/40",
          className,
          textareaClassName
        )}
      />
      {error ? (
        <p className="mt-1 text-caption font-medium text-negative">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-caption text-label-2">{hint}</p>
      ) : null}
    </div>
  );
};
