'use client';

import { CheckCircle2 } from 'lucide-react';

import { cx } from '@/app/components/ui/premium';

type JourneyItem = {
  id: string;
  label: string;
  caption?: string;
};

export default function PropertyJourneyStrip({
  items,
  activeId,
  onSelect,
}: {
  items: JourneyItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const activeIndex = items.findIndex((item) => item.id === activeId);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-3 rounded-[1.8rem] border border-slate-200 bg-white/90 p-3 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)] backdrop-blur">
        {items.map((item, index) => {
          const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'upcoming';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cx(
                'min-w-[180px] rounded-[1.3rem] border px-4 py-3 text-left transition',
                state === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                state === 'active' && 'border-slate-900 bg-slate-950 text-white shadow-[0_18px_34px_-20px_rgba(15,23,42,0.55)]',
                state === 'upcoming' && 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white',
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cx(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                    state === 'done' && 'bg-emerald-600 text-white',
                    state === 'active' && 'bg-white/15 text-white',
                    state === 'upcoming' && 'bg-white text-slate-500',
                  )}
                >
                  {state === 'done' ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
              {item.caption ? (
                <p
                  className={cx(
                    'mt-3 text-xs leading-5',
                    state === 'active' ? 'text-white/72' : 'text-slate-500',
                  )}
                >
                  {item.caption}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
