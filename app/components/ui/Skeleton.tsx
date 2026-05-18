"use client";

import * as React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full" | "card";
}

const ROUNDED_CLS: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
  card: "rounded-card",
};

export function Skeleton({
  rounded = "md",
  className = "",
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse-soft bg-slate-200 ${ROUNDED_CLS[rounded]} ${className}`}
      {...rest}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-card border border-slate-200 bg-white p-5 ${className}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <Skeleton rounded="full" className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton rounded="full" className="h-6 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${className}`}>
      <Skeleton rounded="full" className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}
