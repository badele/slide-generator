'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import type { FontDef } from '@/lib/types';

function familyToFilename(family: string): string {
  return family.replace(/ /g, '');
}

interface Props {
  value: string;
  placeholder?: string;
  fonts: FontDef[];
  onChange: (name: string | undefined) => void;
  className?: string;
}

export function FontSelect({ value, placeholder, fonts, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Unique families with their first available weight
  const families = useMemo(() => {
    const seen = new Set<string>();
    const result: { family: string; weight: number }[] = [];
    for (const f of fonts) {
      if (!seen.has(f.family)) {
        seen.add(f.family);
        result.push({ family: f.family, weight: f.weight ?? 400 });
      }
    }
    return result;
  }, [fonts]);

  // Inject @font-face for each unique family
  useEffect(() => {
    if (families.length === 0) return;
    const style = document.createElement('style');
    style.textContent = families
      .map(f => {
        const base = familyToFilename(f.family);
        return `@font-face { font-family: "${f.family}"; font-weight: ${f.weight}; font-style: normal; src: url('/api/font-file/${base}-${f.weight}.ttf') format('truetype'); }`;
      })
      .join('\n');
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [families]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedEntry = families.find(f => f.family === value);
  const inputCls =
    'bg-gray-800 border border-gray-700 text-gray-100 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500 font-mono text-[11px]';

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex items-center justify-between gap-1 min-w-0`}
      >
        <span
          className="truncate"
          style={
            selectedEntry
              ? { fontFamily: `"${selectedEntry.family}"`, fontWeight: selectedEntry.weight, fontSize: 13 }
              : undefined
          }
        >
          {value || <span className="text-gray-500 font-mono text-[11px]">{placeholder ?? '—'}</span>}
        </span>
        <span className="text-gray-500 text-[9px] shrink-0 ml-1">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 min-w-full w-max bg-gray-800 border border-gray-700 rounded shadow-xl overflow-y-auto max-h-52">
          {value && (
            <button
              className="w-full text-left px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-700 border-b border-gray-700"
              onClick={() => { onChange(undefined); setOpen(false); }}
            >
              — reset
            </button>
          )}
          {families.map(f => (
            <button
              key={f.family}
              className={`w-full text-left px-2.5 py-2 text-sm hover:bg-gray-700 transition-colors ${
                value === f.family ? 'bg-gray-700 text-white' : 'text-gray-200'
              }`}
              style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }}
              onClick={() => { onChange(f.family); setOpen(false); }}
            >
              {f.family}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
