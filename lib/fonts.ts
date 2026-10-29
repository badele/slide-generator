import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';
import type { FontDef } from './types';

export interface SatoriFont {
  name: string;
  data: ArrayBuffer;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: 'normal' | 'italic';
}

interface FontsYamlEntry {
  family: string;
  weights: number[];
  styles: string[];
}

export async function loadFonts(fonts: FontDef[]): Promise<SatoriFont[]> {
  const results: SatoriFont[] = [];
  for (const font of fonts) {
    const fontPath = path.isAbsolute(font.path)
      ? font.path
      : path.join(process.cwd(), font.path);

    if (!fs.existsSync(fontPath)) {
      console.warn(`Font not found: ${fontPath}`);
      continue;
    }

    const buffer = fs.readFileSync(fontPath);
    results.push({
      name: font.family,
      data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      weight: (font.weight ?? 400) as SatoriFont['weight'],
      style: font.style ?? 'normal',
    });
  }
  return results;
}

function parseFontsYaml(): FontsYamlEntry[] {
  const raw = fs.readFileSync(path.join(process.cwd(), 'fonts.yaml'), 'utf-8');
  return (load(raw) as { fonts: FontsYamlEntry[] }).fonts ?? [];
}

export function listAllFontDefs(): FontDef[] {
  const entries = parseFontsYaml();
  const defs: FontDef[] = [];
  for (const entry of entries) {
    const baseName = entry.family.replace(/ /g, '');
    for (const weight of entry.weights) {
      for (const style of entry.styles) {
        const suffix = style === 'italic' ? '-italic' : '';
        defs.push({
          family: entry.family,
          path: `resources/fonts/${baseName}-${weight}${suffix}.ttf`,
          weight,
          style: style as 'normal' | 'italic',
        });
      }
    }
  }
  return defs;
}

let _cachedAllFonts: SatoriFont[] | null = null;

export async function loadAllFonts(): Promise<SatoriFont[]> {
  if (_cachedAllFonts) return _cachedAllFonts;
  _cachedAllFonts = await loadFonts(listAllFontDefs());
  return _cachedAllFonts;
}
