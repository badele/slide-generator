import fs from 'fs';
import path from 'path';
import type { FontDef } from './types';

export interface SatoriFont {
  name: string;
  data: ArrayBuffer;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: 'normal' | 'italic';
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
