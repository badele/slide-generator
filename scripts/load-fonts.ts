#!/usr/bin/env tsx
/**
 * Download Google Fonts as TTF files for use with Satori / next/og.
 * Config: fonts.yaml at project root.
 * Cache: files already present are skipped.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

interface FontEntry {
  family: string;
  weights: number[];
  styles?: ('normal' | 'italic')[];
}

interface FontsConfig {
  downloadDir?: string;
  fonts: FontEntry[];
}

// Safari 5 UA: Google Fonts serves TTF (Satori requires TTF/OTF, not WOFF2)
const TTF_UA =
  'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1';

async function fetchGoogleFontsCss(
  family: string,
  weights: number[],
  styles: ('normal' | 'italic')[]
): Promise<string> {
  // v1 API — more reliable TTF responses with old UA
  const hasItalic = styles.includes('italic');
  const variants: string[] = [];
  for (const w of weights) {
    variants.push(String(w));
    if (hasItalic) variants.push(`${w}i`);
  }
  const url = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${variants.join(',')}`;
  const res = await fetch(url, { headers: { 'User-Agent': TTF_UA } });
  if (!res.ok) throw new Error(`Google Fonts API ${res.status} for "${family}"`);
  return res.text();
}

interface FontFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

function parseFontFaces(css: string): FontFace[] {
  // Iterate blocks in reverse so the last block per (weight, style) wins —
  // Google Fonts lists subsets from largest to smallest; "latin" is last and
  // sufficient for most OG image text.
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].reverse();
  const seen = new Set<string>();
  const result: FontFace[] = [];

  for (const match of blocks) {
    const block = match[1];
    const familyM = /font-family:\s*['"]([^'"]+)['"]/i.exec(block);
    const weightM = /font-weight:\s*(\d+)/i.exec(block);
    const styleM  = /font-style:\s*(\w+)/i.exec(block);
    const urlM    = /src:\s*url\(([^)]+)\)/i.exec(block);
    if (!familyM || !urlM) continue;

    const family = familyM[1];
    const weight = weightM ? parseInt(weightM[1]) : 400;
    const style  = (styleM?.[1] ?? 'normal') as 'normal' | 'italic';
    const key    = `${family}-${weight}-${style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ family, weight, style, url: urlM[1].trim() });
  }

  return result;
}

function toFilename(family: string, weight: number, style: 'normal' | 'italic'): string {
  const slug   = family.replace(/\s+/g, '');
  const italic = style === 'italic' ? '-italic' : '';
  return `${slug}-${weight}${italic}.ttf`;
}

async function main() {
  const configPath = resolve(process.cwd(), 'fonts.yaml');
  if (!existsSync(configPath)) {
    console.error('fonts.yaml not found — nothing to download.');
    return;
  }

  const config = yaml.load(readFileSync(configPath, 'utf8')) as FontsConfig;
  const dir    = resolve(process.cwd(), config.downloadDir ?? 'resources/fonts');
  mkdirSync(dir, { recursive: true });

  let nDownloaded = 0;
  let nCached     = 0;

  for (const entry of config.fonts) {
    const styles = entry.styles ?? ['normal'];
    console.log(`\n▸ ${entry.family} — weights: ${entry.weights.join(', ')} — styles: ${styles.join(', ')}`);

    const css   = await fetchGoogleFontsCss(entry.family, entry.weights, styles);
    const faces = parseFontFaces(css);

    if (faces.length === 0) {
      console.warn('  ⚠  No @font-face found in API response');
      continue;
    }

    for (const face of faces) {
      const filename = toFilename(face.family, face.weight, face.style);
      const dest     = join(dir, filename);

      if (existsSync(dest)) {
        console.log(`  ✓  ${filename} (cached)`);
        nCached++;
        continue;
      }

      process.stdout.write(`  ↓  ${filename} … `);
      const res = await fetch(face.url);
      if (!res.ok) {
        console.log(`FAIL (HTTP ${res.status})`);
        continue;
      }
      const buf = await res.arrayBuffer();
      writeFileSync(dest, Buffer.from(buf));
      console.log(`done (${(buf.byteLength / 1024).toFixed(0)} KB)`);
      nDownloaded++;
    }
  }

  console.log(`\n✅  ${nDownloaded} downloaded, ${nCached} already cached.\n`);
}

main().catch((err) => {
  console.error('\n✗  Font loading failed:', err.message);
  process.exit(1);
});
