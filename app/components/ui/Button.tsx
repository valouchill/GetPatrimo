"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "premium" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  type?: "button" | "submit" | "reset";
}

const VARIANT_CLS: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-white shadow-amber hover:bg-amber-600 active:bg-amber-700 focus-visible:ring-amber-500",
  secondary:
    "bg-emerald-900 text-white shadow-emerald hover:bg-emerald-800 active:bg-emerald-950 focus-visible:ring-emerald-700",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500",
  premium:
    "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-premium hover:from-amber-600 hover:to-amber-700 focus-visible:ring-amber-500",
  outline:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-400",
};

const SIZE_CLS: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs gap-1.5",
  md: "h-11 px-5 text-sm gap-2",       // 44px min — touch target
  lg: "h-12 px-6 text-sm gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      iconLeft,
      iconRight,
      disabled,
      children,
      className = "",
      type = "button",
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={[
          "inline-flex items-center justify-center rounded-button font-semibold tracking-tight transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-55",
          VARIANT_CLS[variant],
          SIZE_CLS[size],
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          iconLeft && <span className="shrink-0">{iconLeft}</span>
        )}
        <span className="truncate">{children}</span>
        {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  }
);
