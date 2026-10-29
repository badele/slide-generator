'use client';
import { useState, useEffect, useCallback } from 'react';
import type { TemplateInfo } from '@/lib/types';

function formatName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6 cursor-pointer"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain cursor-default shadow-2xl rounded-lg"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

export default function TemplateCard({ template }: { template: TemplateInfo }) {
  const { name, palette, output } = template;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const previewUrl = `/api/generate?template=${encodeURIComponent(name)}`;
  const openLightbox = useCallback(() => setLightboxOpen(true), []);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  return (
    <>
      {lightboxOpen && <Lightbox src={previewUrl} alt={formatName(name)} onClose={closeLightbox} />}

      <div className="group bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-600 transition-all duration-200 hover:scale-[1.02] flex flex-col h-full">
        <div
          className="w-full overflow-hidden bg-gray-800 shrink-0 cursor-zoom-in"
          style={{ aspectRatio: String(output.width / output.height) }}
          onClick={openLightbox}
        >
          <img
            src={previewUrl}
            alt={`Preview ${name}`}
            loading="lazy"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="p-3 flex flex-col flex-1">
          <p className="text-sm font-semibold text-white mb-0.5">{formatName(name)}</p>
          <p className="text-xs text-gray-400 mb-2">{output.width} × {output.height}</p>

          <div className="flex gap-1 mb-3">
            {palette.slice(0, 6).map((color, i) => (
              <span
                key={i}
                className="w-3 h-3 rounded-full border border-gray-700"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <a
            href={`/?template=${encodeURIComponent(name)}`}
            className="mt-auto block w-full text-center px-2 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors"
          >
            Utiliser →
          </a>
        </div>
      </div>
    </>
  );
}
