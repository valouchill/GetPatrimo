'use client';

import { ReactNode } from 'react';

interface BaseProps {
  label: string;
  name: string;
  value: string | number | boolean | null | undefined;
  onChange: (value: any) => void;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'email' | 'tel';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  className?: string;
  readOnly?: boolean;
  help?: ReactNode;
}

export function EditField(props: BaseProps) {
  const { label, name, value, onChange, type = 'text', options, className = '', readOnly, help } = props;

  const commonInput =
    'w-full border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500';

  const toDateInputValue = (v: any) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  let input: ReactNode;
  if (type === 'textarea') {
    input = (
      <textarea
        name={name}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        rows={props.rows || 3}
        placeholder={props.placeholder}
        disabled={readOnly}
        className={commonInput}
      />
    );
  } else if (type === 'select') {
    input = (
      <select
        name={name}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        className={commonInput}
      >
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else if (type === 'checkbox') {
    input = (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={name}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={readOnly}
          className="rounded border-gray-300"
        />
        <span className="text-gray-700">{label}</span>
      </label>
    );
  } else if (type === 'date') {
    input = (
      <input
        type="date"
        name={name}
        value={toDateInputValue(value)}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={readOnly}
        className={commonInput}
      />
    );
  } else if (type === 'number') {
    input = (
      <input
        type="number"
        name={name}
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
        min={props.min}
        max={props.max}
        step={props.step || 'any'}
        placeholder={props.placeholder}
        disabled={readOnly}
        className={commonInput}
      />
    );
  } else {
    input = (
      <input
        type={type}
        name={name}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={readOnly}
        className={commonInput}
      />
    );
  }

  if (type === 'checkbox') {
    return <div className={className}>{input}{help && <div className="text-xs text-gray-500 mt-0.5">{help}</div>}</div>;
  }

  return (
    <div className={className}>
      <label htmlFor={name} className="block text-xs font-medium text-gray-600 mb-0.5">
        {label}
      </label>
      {input}
      {help && <div className="text-xs text-gray-500 mt-0.5">{help}</div>}
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h2 className="font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}
