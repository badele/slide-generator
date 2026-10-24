import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Handlebars from 'handlebars';
import { SlideTemplateSchema, type SlideTemplate, type StyleDef, type ParamDef } from './types';

const PROFILES_DIR = path.join(process.cwd(), 'profiles');

// CSS properties that must be numbers — coerce "0.75" → 0.75 when they arrive as strings
const NUMERIC_CSS_PROPS = new Set([
  'opacity', 'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'zIndex', 'order', 'lineHeight',
]);

function coerceStyle(style: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(style)) {
    if (typeof v === 'string' && NUMERIC_CSS_PROPS.has(k)) {
      const n = parseFloat(v);
      out[k] = isNaN(n) ? v : n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function listTemplates(): string[] {
  if (!fs.existsSync(PROFILES_DIR)) return [];
  return fs
    .readdirSync(PROFILES_DIR)
    .filter((dir) => {
      const tpl = path.join(PROFILES_DIR, dir, 'template.yaml');
      return fs.existsSync(tpl);
    });
}

export function loadTemplateRaw(name: string): string {
  const tplPath = path.join(PROFILES_DIR, name, 'template.yaml');
  if (!fs.existsSync(tplPath)) {
    throw new Error(`Template "${name}" not found`);
  }
  return fs.readFileSync(tplPath, 'utf8');
}

export function parseTemplate(
  yamlStr: string,
  params: Record<string, string> = {}
): SlideTemplate {
  // 1. Apply defaults then user params
  const rawParsed = yaml.load(yamlStr) as any;
  const rawPalette: string[] = rawParsed?.palette ?? [];
  const defaults: Record<string, string> = {};
  if (rawParsed?.params) {
    for (const [key, def] of Object.entries(rawParsed.params as Record<string, any>)) {
      if (def?.default !== undefined && def.default !== '') {
        if (typeof def.default === 'number' && rawPalette.length > 0) {
          const color = rawPalette[def.default - 1];
          if (color) defaults[key] = color;
        } else {
          defaults[key] = String(def.default);
        }
      }
    }
  }
  const mergedParams = { ...defaults, ...params };

  // 2. Escape values for safe injection inside YAML double-quoted strings
  const escapedParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(mergedParams)) {
    escapedParams[k] = v
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
  }

  // 3. Substitute {{ var }} with Handlebars
  const compiled = Handlebars.compile(yamlStr, { noEscape: true });
  const substituted = compiled(escapedParams);

  // 4. Parse substituted YAML
  const parsed = yaml.load(substituted) as any;

  // Resolve numeric palette references in param defaults before Zod validation
  const palette: string[] = parsed?.palette ?? [];
  if (parsed?.params && palette.length > 0) {
    for (const def of Object.values(parsed.params as Record<string, any>)) {
      if (typeof def?.default === 'number') {
        const color = palette[def.default - 1];
        if (color) def.default = color;
      }
    }
  }

  // 5. Validate with Zod
  const result = SlideTemplateSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.issues.map((i) => i.message).join(', '));
  }
  return result.data;
}

// Resolve a param's effective CSS style by merging template defaults + param.style
function resolveStyle(
  paramDef: ParamDef | undefined,
  templateDefaults: StyleDef | undefined,
  palette: string[]
): Record<string, any> {
  const td = templateDefaults ?? {};
  const ps = paramDef?.style ?? {};

  const mergedFont = { ...(td.font ?? {}), ...(ps.font ?? {}) };
  const fg = ps.fg !== undefined ? ps.fg : td.fg;
  const bg = ps.bg !== undefined ? ps.bg : td.bg;
  const orientation = ps.orientation !== undefined ? ps.orientation : td.orientation;

  const css: Record<string, any> = {};
  if (fg !== undefined && fg >= 1 && fg <= palette.length) css.color = palette[fg - 1];
  if (bg !== undefined && bg >= 1 && bg <= palette.length) css.backgroundColor = palette[bg - 1];
  if (mergedFont.name) css.fontFamily = mergedFont.name;
  if (mergedFont.size !== undefined) css.fontSize = mergedFont.size;
  if (mergedFont.weight !== undefined) css.fontWeight = mergedFont.weight;
  if (orientation !== undefined) css.transform = `rotate(${orientation}deg)`;
  return css;
}

type Align = 'left' | 'center' | 'right';

function parseInlineMarkup(
  text: string,
  baseStyle: Record<string, any>,
  palette: string[]
): { element: any; align: Align } {
  const resolveColor = (ref: string): string | null => {
    const idx = parseInt(ref, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= palette.length) return palette[idx - 1];
    return null;
  };

  // Extract leading [ALIGN=x] tag (no closing [/])
  let align: Align = 'left';
  let workText = text;
  const alignMatch = /^\[ALIGN=(left|center|right)\]/i.exec(workText);
  if (alignMatch) {
    align = alignMatch[1].toLowerCase() as Align;
    workText = workText.slice(alignMatch[0].length);
  }

  if (!workText.includes('[')) {
    return { element: { type: 'span', props: { style: baseStyle, children: workText } }, align };
  }

  // Parse inline tags: [FG=N BG=N FN=name FS=N FW=N ROT=N]text[/]
  const tagRegex = /\[([^\]\/][^\]]*)\]([\s\S]*?)\[\/\]/g;
  const segments: Array<{ text: string; override: Record<string, any> | null }> = [];
  let lastIndex = 0;

  for (const match of workText.matchAll(tagRegex)) {
    if (match.index! > lastIndex) {
      segments.push({ text: workText.slice(lastIndex, match.index), override: null });
    }
    const override: Record<string, any> = {};
    for (const prop of match[1].matchAll(/(\w+)=([^\s\]]+)/g)) {
      const key = prop[1].toUpperCase();
      const val = prop[2];
      if (key === 'FG') { const c = resolveColor(val); if (c) override.color = c; }
      else if (key === 'BG') { const c = resolveColor(val); if (c) override.backgroundColor = c; }
      else if (key === 'FN') { override.fontFamily = val; }
      else if (key === 'FS') { const n = parseInt(val, 10); if (!isNaN(n)) override.fontSize = n; }
      else if (key === 'FW') { const n = parseInt(val, 10); if (!isNaN(n)) override.fontWeight = n; }
      else if (key === 'ROT') { const n = parseInt(val, 10); if (!isNaN(n)) override.transform = `rotate(${n}deg)`; }
    }
    segments.push({ text: match[2], override });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < workText.length) segments.push({ text: workText.slice(lastIndex), override: null });

  const hasMarkup = segments.some(s => s.override && Object.keys(s.override).length > 0);
  if (!hasMarkup && segments.length <= 1) {
    return { element: { type: 'span', props: { style: baseStyle, children: workText } }, align };
  }

  return {
    element: {
      type: 'div',
      props: {
        style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline' },
        children: segments
          .filter(s => s.text.length > 0)
          .map(s => ({
            type: 'span',
            props: { style: s.override ? { ...baseStyle, ...s.override } : baseStyle, children: s.text },
          })),
      },
    },
    align,
  };
}

const alignToJustify = (a: Align) =>
  a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start';

export function expandSpecialElements(
  node: any,
  palette: string[] = [],
  paramDefs: Record<string, ParamDef> = {},
  templateDefaults?: StyleDef
): any {
  if (!node || typeof node !== 'object') return node;

  // Resolve styles from param: reference if present
  let paramStyle: Record<string, any> = {};
  let paramSplit: boolean | undefined = undefined;

  if (node.props?.param) {
    const paramKey: string = node.props.param;
    const paramDef = paramDefs[paramKey];
    paramStyle = resolveStyle(paramDef, templateDefaults, palette);
    paramSplit = paramDef?.style?.split;
  }

  if (node.type === 'image') {
    const src: string = node.props?.src ?? '';
    const toNum = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    let imgWidth = toNum(node.props?.imgWidth);
    let imgHeight = toNum(node.props?.imgHeight);
    const x: number = toNum(node.props?.x) ?? 50;
    const y: number = toNum(node.props?.y) ?? 50;
    const containerStyle = node.props?.containerStyle ?? {};

    const toFlex = (v: number) => v <= 25 ? 'flex-start' : v >= 75 ? 'flex-end' : 'center';

    if (!src) return { type: 'div', props: { style: { display: 'flex', ...containerStyle } } };

    // If no explicit dimensions and src is an SVG data:URI, extract intrinsic size from markup
    if (imgWidth == null && imgHeight == null && src.startsWith('data:image/svg')) {
      try {
        const base64 = src.split(',')[1] ?? '';
        const svgStr = Buffer.from(base64, 'base64').toString('utf8');
        const wAttr = svgStr.match(/\bwidth="([^"]+)"/)?.[1];
        const hAttr = svgStr.match(/\bheight="([^"]+)"/)?.[1];
        const vbParts = svgStr.match(/\bviewBox="[^"]*?\s+([\d.]+)\s+([\d.]+)"/);
        imgWidth = wAttr ? parseFloat(wAttr) : (vbParts ? parseFloat(vbParts[1]) : null);
        imgHeight = hAttr ? parseFloat(hAttr) : (vbParts ? parseFloat(vbParts[2]) : null);
        if (imgWidth && isNaN(imgWidth)) imgWidth = null;
        if (imgHeight && isNaN(imgHeight)) imgHeight = null;
      } catch { /* ignore */ }
    }

    const imgStyle: Record<string, any> = {};
    if (imgWidth != null) imgStyle.width = imgWidth;
    if (imgHeight != null) imgStyle.height = imgHeight;

    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          justifyContent: toFlex(x),
          alignItems: toFlex(y),
          ...containerStyle,
        },
        children: [{ type: 'img', props: { src, style: imgStyle } }],
      },
    };
  }

  if (node.type === 'lines') {
    const text: string = node.props?.children ?? '';
    const explicitStyle = node.props?.style ?? {};
    const style = { ...paramStyle, ...explicitStyle };
    const containerStyle = node.props?.containerStyle ?? {};

    // split priority: param.style.split > node.props.split > true (default)
    const splitProp = paramSplit !== undefined ? paramSplit : node.props?.split;
    const doSplit = splitProp !== false && splitProp !== 'false';

    if (!doSplit) {
      const { element } = parseInlineMarkup(text, { ...style, whiteSpace: 'pre-wrap' }, palette);
      return { ...element, props: { ...element.props, style: { ...element.props.style, alignSelf: 'flex-start' } } };
    }

    const rawLines = text.split('\n');
    // Trim leading and trailing blank lines, keep inner blank lines as spacers
    while (rawLines.length > 0 && rawLines[0].trim() === '') rawLines.shift();
    while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') rawLines.pop();
    const lineHeight = Number(style.fontSize ?? 28);
    return {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, ...containerStyle },
        children: rawLines.map((line: string) => {
          if (line.trim() === '') {
            return { type: 'div', props: { style: { display: 'flex', height: lineHeight } } };
          }
          const { element, align } = parseInlineMarkup(line, style, palette);
          return {
            type: 'div',
            props: { style: { display: 'flex', justifyContent: alignToJustify(align) }, children: [element] },
          };
        }),
      },
    };
  }

  // Handle param: on non-lines elements
  if (node.props?.param) {
    const { param: _param, ...restProps } = node.props;
    const explicitStyle = restProps.style ?? {};
    const mergedStyle = { ...paramStyle, ...explicitStyle };
    const children = restProps.children;

    if (typeof children === 'string' && children.includes('[')) {
      const { element } = parseInlineMarkup(children, mergedStyle, palette);
      return element;
    }

    return {
      ...node,
      props: { ...restProps, style: mergedStyle },
    };
  }

  if (Array.isArray(node.props?.children)) {
    // When a child is `type: background`, lift its color onto this parent div and
    // replace it with an absolutely-positioned <img> if a src is provided.
    // This avoids Satori issues with backgroundColor on position:absolute divs.
    let extraStyle: Record<string, any> = {};
    const expandedChildren: any[] = [];
    for (const c of node.props.children) {
      if (c?.type === 'background') {
        const color: string = c.props?.color ?? '';
        const src: string = c.props?.src ?? '';
        const width: number = Number(c.props?.width) || 0;
        const height: number = Number(c.props?.height) || 0;
        if (color) extraStyle.backgroundColor = color;
        if (src) {
          expandedChildren.push({
            type: 'img',
            props: {
              src,
              style: { position: 'absolute', top: 0, left: 0, width, height, objectFit: 'cover' },
            },
          });
        }
      } else {
        expandedChildren.push(expandSpecialElements(c, palette, paramDefs, templateDefaults));
      }
    }
    return {
      ...node,
      props: {
        ...node.props,
        style: coerceStyle({ ...(node.props?.style ?? {}), ...extraStyle }),
        children: expandedChildren,
      },
    };
  }

  // Coerce numeric style props on leaf nodes too
  if (node.props?.style) {
    return { ...node, props: { ...node.props, style: coerceStyle(node.props.style) } };
  }

  return node;
}

export function loadTemplate(
  name: string,
  params: Record<string, string> = {}
): SlideTemplate {
  const raw = loadTemplateRaw(name);
  return parseTemplate(raw, params);
}
