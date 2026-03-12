'use client';

import { useCallback, useRef, useState, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export default function OtpInput({ length = 6, onComplete, disabled = false }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const focusAt = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    refs.current[clamped]?.focus();
    refs.current[clamped]?.select();
  }, [length]);

  const handleChange = useCallback(
    (index: number, digit: string) => {
      if (!/^\d$/.test(digit) && digit !== '') return;

      const next = [...values];
      next[index] = digit;
      setValues(next);

      if (digit && index < length - 1) {
        focusAt(index + 1);
      }

      if (digit && next.every((v) => v !== '')) {
        onComplete(next.join(''));
      }
    },
    [values, length, focusAt, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (values[index]) {
          const next = [...values];
          next[index] = '';
          setValues(next);
        } else if (index > 0) {
          const next = [...values];
          next[index - 1] = '';
          setValues(next);
          focusAt(index - 1);
        }
      } else if (e.key === 'ArrowLeft') {
        focusAt(index - 1);
      } else if (e.key === 'ArrowRight') {
        focusAt(index + 1);
      }
    },
    [values, focusAt]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (pasted.length === 0) return;
      const next = [...values];
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      setValues(next);
      if (pasted.length === length) {
        onComplete(next.join(''));
      } else {
        focusAt(pasted.length);
      }
    },
    [values, length, focusAt, onComplete]
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {values.map((value, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value.slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          onFocus={(e) => e.target.select()}
          className={`
            w-12 h-14 sm:w-14 sm:h-16
            text-center text-2xl sm:text-3xl font-mono font-bold
            bg-white/60 backdrop-blur-sm
            border-2 rounded-xl
            outline-none transition-all duration-200
            ${disabled
              ? 'border-slate-200 text-slate-400 cursor-not-allowed'
              : value
                ? 'border-emerald-500 text-slate-900 shadow-md shadow-emerald-500/10'
                : 'border-slate-200 text-slate-900 focus:border-emerald-600 focus:shadow-lg focus:shadow-emerald-500/15'
            }
          `}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}
