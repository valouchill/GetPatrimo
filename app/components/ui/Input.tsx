"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const INPUT_BASE =
  "h-11 w-full rounded-input border bg-white px-3.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      description,
      error,
      iconLeft,
      iconRight,
      fullWidth = true,
      className = "",
      id,
      type = "text",
      inputMode,
      ...rest
    },
    ref
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const descId = description ? `${inputId}-desc` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    // Auto-inputMode from type for mobile keyboards
    const resolvedInputMode =
      inputMode ??
      (type === "tel"
        ? "tel"
        : type === "email"
        ? "email"
        : type === "number"
        ? "numeric"
        : type === "url"
        ? "url"
        : undefined);

    const borderCls = error
      ? "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500"
      : "border-slate-200 hover:border-slate-300 focus-visible:border-amber-500 focus-visible:ring-amber-500";

    return (
      <div className={fullWidth ? "w-full" : "inline-block"}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {iconLeft && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            inputMode={resolvedInputMode}
            aria-invalid={error ? true : undefined}
            aria-describedby={[descId, errorId].filter(Boolean).join(" ") || undefined}
            className={[
              INPUT_BASE,
              borderCls,
              iconLeft ? "pl-10" : "",
              iconRight ? "pr-10" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...rest}
          />
          {iconRight && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {iconRight}
            </span>
          )}
        </div>
        {description && !error && (
          <p id={descId} className="mt-1.5 text-xs text-slate-500">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }
);
