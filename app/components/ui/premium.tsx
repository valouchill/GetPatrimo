import * as React from 'react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SurfaceTone = 'default' | 'soft' | 'hero' | 'dark';
type SurfacePadding = 'sm' | 'md' | 'lg';
type StatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'dark' | 'premium';
type MetricTone = 'default' | 'soft' | 'dark' | 'accent';
type QuickStatTone = 'default' | 'accent' | 'dark';

const surfaceToneStyles: Record<SurfaceTone, string> = {
  default: 'border-white/80 bg-white shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)]',
  soft: 'border-slate-200 bg-slate-50/80 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.12)]',
  hero: 'border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(184,145,87,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.05),_transparent_34%),linear-gradient(145deg,#fffdf8_0%,#f6f3ec_100%)] shadow-[0_24px_80px_-42px_rgba(15,23,42,0.18)]',
  dark: 'border-slate-900 bg-[linear-gradient(145deg,#0f172a,#111827_42%,#0f766e)] text-white shadow-[0_28px_90px_-44px_rgba(15,23,42,0.72)]',
};

const surfacePaddingStyles: Record<SurfacePadding, string> = {
  sm: 'p-5 sm:p-6',
  md: 'p-6 sm:p-7',
  lg: 'p-7 sm:p-8',
};

const statusToneStyles: Record<StatusTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  dark: 'border-slate-800 bg-slate-950 text-white',
  premium: 'border-white/15 bg-white/10 text-white',
};

const metricToneStyles: Record<MetricTone, string> = {
  default: 'border-slate-200 bg-white',
  soft: 'border-slate-200 bg-slate-50',
  dark: 'border-white/10 bg-white/10 text-white',
  accent: 'border-emerald-200 bg-emerald-50',
};

const quickStatToneStyles: Record<QuickStatTone, string> = {
  default: 'border-slate-200 bg-white text-slate-950',
  accent: 'border-slate-900 bg-slate-900 text-white',
  dark: 'border-white/10 bg-white/10 text-white',
};

const signalToneStyles: Record<StatusTone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  dark: 'bg-slate-900',
  premium: 'bg-white',
};

export function PremiumSurface({
  children,
  className,
  tone = 'default',
  padding = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: SurfaceTone;
  padding?: SurfacePadding;
}) {
  return (
    <section
      className={cx(
        'min-w-0 overflow-hidden rounded-[2rem] border backdrop-blur',
        surfaceToneStyles[tone],
        surfacePaddingStyles[padding],
        className
      )}
    >
      {children}
    </section>
  );
}

export function PremiumSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  align = 'left',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div
      className={cx(
        'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between',
        align === 'center' && 'items-center text-center',
        className
      )}
    >
      <div className="min-w-0 max-w-3xl space-y-3">
        {eyebrow ? <PremiumEyebrow>{eyebrow}</PremiumEyebrow> : null}
        <h2 className="max-w-full text-balance font-serif text-3xl tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-full text-pretty text-sm leading-6 text-slate-600 sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <ActionBar className={align === 'center' ? 'justify-center' : 'justify-start lg:justify-end'}>{actions}</ActionBar> : null}
    </div>
  );
}

export function PremiumEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500', className)}>
      {children}
    </div>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]',
        statusToneStyles[tone],
        className
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-2 truncate">{label}</span>
    </span>
  );
}

export function MetricTile({
  label,
  value,
  caption,
  tone = 'soft',
  className,
  valueClassName,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  caption?: React.ReactNode;
  tone?: MetricTone;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cx(
        'min-w-0 rounded-[1.35rem] border px-4 py-4',
        metricToneStyles[tone],
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className={cx('mt-2 break-words text-xl font-semibold text-slate-950 sm:text-2xl', tone === 'dark' && 'text-white', valueClassName)}>
        {value}
      </p>
      {caption ? (
        <p className={cx('mt-2 break-words text-sm leading-5 text-slate-500', tone === 'dark' && 'text-slate-300')}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function QuickStat({
  label,
  value,
  caption,
  tone = 'default',
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  caption?: React.ReactNode;
  tone?: QuickStatTone;
  className?: string;
}) {
  const isDark = tone === 'dark' || tone === 'accent';

  return (
    <div
      className={cx(
        'min-w-0 rounded-[1.2rem] border px-4 py-3',
        quickStatToneStyles[tone],
        className
      )}
    >
      <div className={cx('text-[10px] font-semibold uppercase tracking-[0.2em]', isDark ? 'text-white/55' : 'text-slate-400')}>
        {label}
      </div>
      <div className={cx('mt-2 break-words text-base font-semibold sm:text-lg', isDark ? 'text-white' : 'text-slate-950')}>
        {value}
      </div>
      {caption ? (
        <div className={cx('mt-1 break-words text-xs leading-5', isDark ? 'text-white/70' : 'text-slate-500')}>
          {caption}
        </div>
      ) : null}
    </div>
  );
}

export function InfoRow({
  label,
  value,
  className,
  valueClassName,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col gap-2 rounded-[1.15rem] border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className={cx('min-w-0 break-words text-sm font-semibold text-slate-900 sm:max-w-[58%] sm:text-right', valueClassName)}>
        {value}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/90 px-6 py-10 text-center',
        className
      )}
    >
      {icon ? (
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-slate-200 bg-white shadow-sm">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function TimelineBlock({
  items,
  className,
}: {
  items: Array<{
    id: string;
    title: string;
    description: React.ReactNode;
    status?: string;
    meta?: React.ReactNode;
  }>;
  className?: string;
}) {
  return (
    <div className={cx('space-y-4', className)}>
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-4">
          <div
            className={cx(
              'mt-2 h-3 w-3 flex-shrink-0 rounded-full',
              item.status === 'success' && 'bg-emerald-500',
              item.status === 'warning' && 'bg-amber-500',
              item.status === 'danger' && 'bg-rose-500',
              item.status === 'sealed' && 'bg-slate-700',
              !item.status && 'bg-blue-500'
            )}
          />
          <div className="min-w-0 flex-1 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{item.title}</p>
              {item.meta ? (
                <div className="text-xs text-slate-400 sm:text-right">{item.meta}</div>
              ) : null}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}

export function StageRail({
  items,
  activeId,
  onSelect,
  className,
}: {
  items: Array<{
    id: string;
    label: React.ReactNode;
    count?: React.ReactNode;
    caption?: React.ReactNode;
  }>;
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <div className="inline-flex min-w-full gap-2 rounded-[1.6rem] border border-slate-200 bg-white/90 p-2 backdrop-blur">
        {items.map((item) => {
          const active = item.id === activeId;
          const content = (
            <div className="min-w-0">
              <div className={cx('text-sm font-semibold', active ? 'text-white' : 'text-slate-600')}>
                {item.label}
                {item.count !== undefined ? <span className={cx('ml-2 text-xs', active ? 'text-white/70' : 'text-slate-400')}>{item.count}</span> : null}
              </div>
              {item.caption ? (
                <div className={cx('mt-1 hidden text-[11px] leading-5 md:block', active ? 'text-white/65' : 'text-slate-400')}>
                  {item.caption}
                </div>
              ) : null}
            </div>
          );

          if (!onSelect) {
            return (
              <div
                key={item.id}
                className={cx(
                  'min-w-[150px] rounded-[1.2rem] px-4 py-3 transition',
                  active ? 'bg-slate-950 text-white shadow-[0_14px_34px_-20px_rgba(15,23,42,0.45)]' : 'bg-transparent'
                )}
              >
                {content}
              </div>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cx(
                'min-w-[150px] rounded-[1.2rem] px-4 py-3 text-left transition',
                active
                  ? 'bg-slate-950 text-white shadow-[0_14px_34px_-20px_rgba(15,23,42,0.45)]'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SignalList({
  items,
  className,
}: {
  items: Array<{
    id: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    tone?: StatusTone;
    meta?: React.ReactNode;
  }>;
  className?: string;
}) {
  const normalizedItems = items.filter((item) => item && (item.title || item.description));

  if (normalizedItems.length === 0) return null;

  return (
    <div className={cx('space-y-3', className)}>
      {normalizedItems.map((item) => (
        <div key={item.id} className="flex items-start gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50/90 px-4 py-3">
          <div className={cx('mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full', signalToneStyles[item.tone || 'neutral'])} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 break-words text-sm font-semibold text-slate-900">{item.title}</div>
              {item.meta ? <div className="text-xs text-slate-400 sm:text-right">{item.meta}</div> : null}
            </div>
            {item.description ? <div className="mt-1 break-words text-sm leading-6 text-slate-600">{item.description}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocumentStateChip({
  status,
  label,
  className,
}: {
  status?: string;
  label?: React.ReactNode;
  className?: string;
}) {
  const tone =
    status === 'certified' || status === 'success'
      ? 'success'
      : status === 'needs_review' || status === 'review' || status === 'flagged'
        ? 'warning'
        : status === 'rejected' || status === 'illegible' || status === 'blocked'
          ? 'danger'
          : status === 'locked'
            ? 'dark'
            : 'neutral';

  return <StatusBadge tone={tone} label={label || status || 'en attente'} className={className} />;
}
