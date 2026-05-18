"use client";

import * as React from "react";

type Variant = "default" | "elevated" | "premium" | "dashed" | "subtle";
type Padding = "none" | "sm" | "md" | "lg";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  asChild?: boolean;
}

const VARIANT_CLS: Record<Variant, string> = {
  default:
    "bg-white border border-slate-200 shadow-card",
  elevated:
    "bg-white border border-slate-200 shadow-elevated",
  premium:
    "bg-gradient-to-br from-emerald-950 to-emerald-900 text-white shadow-premium",
  dashed:
    "bg-slate-50 border-2 border-dashed border-slate-300",
  subtle:
    "bg-slate-50 border border-slate-100",
};

const PADDING_CLS: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  function Card(
    { variant = "default", padding = "md", className = "", children, ...rest },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={[
          "rounded-card transition-shadow",
          VARIANT_CLS[variant],
          PADDING_CLS[padding],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`font-serif text-xl font-bold tracking-tight text-slate-900 ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`mt-1 text-sm text-slate-500 ${className}`}>{children}</p>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-5 flex items-center justify-end gap-2 ${className}`}>
      {children}
    </div>
  );
}
