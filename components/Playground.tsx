'use client';

import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react';
import type { TemplateInfo, ParamDef, StyleDef } from '@/lib/types';
import { YamlEditor } from './YamlEditor';
import yaml from 'js-yaml';

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, cleanUndefined(v)])
  );
}

function copyStyleDef(style?: StyleDef): StyleDef {
  if (!style) return {};
  return { ...style, font: style.font ? { ...style.font } : undefined };
}

interface Props {
  templates: TemplateInfo[];
}

type Tab = 'template' | 'free' | 'og' | 'images';

const FREE_MODE_DEFAULT_YAML = `version: '1'
name: simple
description: "Minimal template with title, subtitle and optional background image"
output:
  width: 1200
  height: 675

fonts:
  - family: NEXTART-Heavy
    path: "resources/fonts/NEXT ART_Heavy.otf"
    weight: 900
  - family: NEXTART-Light
    path: "resources/fonts/NEXT ART_Light.otf"
    weight: 300

palette:
  - "#104362" # 1 — dark blue (background)
  - "#FFD300" # 2 — yellow (title)
  - "#FFFFFF" # 3 — white (subtitle)

defaults:
  fg: 3
  font:
    name: "NEXTART-Light"
    size: 36
    weight: 300

params:
  background:
    description: "Background color"
    default: 1
    type: color
  hero_image:
    description: "Background image URL (optional)"
    default: ""
    type: url
  title:
    description: "Main title"
    required: true
    default: "Slide Generator"
  title_color:
    description: "Title color"
    default: 2
    type: color
  subtitle:
    description: "Subtitle"
    default: "Generate beautiful slides with YAML"

element:
  type: div
  props:
    style:
      display: flex
      width: 1200
      height: 675
      position: relative
    children:
      - type: background
        props:
          color: "{{ background }}"
          src: "{{ hero_image }}"
          width: 1200
          height: 675
      - type: div
        props:
          style:
            display: flex
            flexDirection: column
            justifyContent: flex-end
            padding: "58px"
            width: 1200
            height: 675
            gap: 16
          children:
            - type: span
              props:
                style:
                  fontSize: 80
                  fontWeight: 900
                  fontFamily: "NEXTART-Heavy"
                  color: "{{ title_color }}"
                  lineHeight: 1.1
                children: "{{ title }}"
            - type: span
              props:
                style:
                  fontSize: 36
                  fontWeight: 300
                  fontFamily: "NEXTART-Light"
                  color: "#FFFFFF"
                  opacity: 0.85
                children: "{{ subtitle }}"
`;

export function Playground({ templates }: Props) {
  const [tab, setTab] = useState<Tab>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(
    templates[0] ?? null
  );
  const [params, setParams] = useState<Record<string, string>>(() => {
    const tpl = templates[0];
    if (!tpl) return {};
    const palette = tpl.palette ?? [];
    const defaults: Record<string, string> = {};
    for (const [key, def] of Object.entries(tpl.params)) {
      const d = def.default;
      defaults[key] = typeof d === 'number' ? (palette[d - 1] ?? String(d)) : (d ?? '');
    }
    return defaults;
  });
  const [yamlText, setYamlText] = useState(FREE_MODE_DEFAULT_YAML);
  const [freeParams, setFreeParams] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyToFreeLoading, setCopyToFreeLoading] = useState(false);
  const [ogUrl, setOgUrl] = useState('');
  const [ogData, setOgData] = useState<Record<string, string> | null>(null);
  const [ogError, setOgError] = useState<string | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [leftWidth, setLeftWidth] = useState(420);
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'settings' | 'preview'>('settings');
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const [baseYaml, setBaseYaml] = useState('');
  const [currentPalette, setCurrentPalette] = useState<string[]>(
    () => [...(templates[0]?.palette ?? [])]
  );
  const [currentDefaults, setCurrentDefaults] = useState<StyleDef>(
    () => copyStyleDef(templates[0]?.defaults)
  );
  const [currentParamStyles, setCurrentParamStyles] = useState<Record<string, StyleDef>>(() => {
    const tpl = templates[0];
    if (!tpl) return {};
    const styles: Record<string, StyleDef> = {};
    for (const [key, def] of Object.entries(tpl.params)) {
      styles[key] = copyStyleDef(def.style);
    }
    return styles;
  });

  const computedDefaults = useMemo(() => {
    if (!selectedTemplate) return {} as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [key, def] of Object.entries(selectedTemplate.params)) {
      const d = def.default;
      result[key] = typeof d === 'number' ? (currentPalette[d - 1] ?? String(d)) : (d ?? '');
    }
    return result;
  }, [selectedTemplate, currentPalette]);

  const modifiedParamKeys = useMemo(
    () => new Set(Object.keys(params).filter(k => params[k] !== (computedDefaults[k] ?? ''))),
    [params, computedDefaults]
  );

  const hasEdits = useMemo(() => {
    if (!selectedTemplate) return false;
    if (modifiedParamKeys.size > 0) return true;
    if (!deepEqual(currentPalette, selectedTemplate.palette ?? [])) return true;
    if (!deepEqual(currentDefaults, selectedTemplate.defaults ?? {})) return true;
    for (const [key, def] of Object.entries(selectedTemplate.params)) {
      if (!deepEqual(currentParamStyles[key] ?? {}, def.style ?? {})) return true;
    }
    return false;
  }, [selectedTemplate, currentPalette, currentDefaults, currentParamStyles, modifiedParamKeys]);

  const buildModifiedYaml = useCallback((): string => {
    if (!baseYaml) return '';
    try {
      const parsed = yaml.load(baseYaml) as any;
      parsed.palette = currentPalette;
      const cleanDefs = cleanUndefined(currentDefaults);
      if (Object.keys(cleanDefs).length > 0) parsed.defaults = cleanDefs;
      else delete parsed.defaults;
      for (const [key, style] of Object.entries(currentParamStyles)) {
        if (!parsed.params?.[key]) continue;
        const cleanStyle = cleanUndefined(style);
        if (Object.keys(cleanStyle).length > 0) parsed.params[key].style = cleanStyle;
        else delete parsed.params[key].style;
      }
      for (const key of modifiedParamKeys) {
        if (!parsed.params?.[key]) continue;
        const val = params[key];
        if (val !== '') parsed.params[key].default = val;
      }
      return yaml.dump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
    } catch {
      return baseYaml;
    }
  }, [baseYaml, currentPalette, currentDefaults, currentParamStyles, params, modifiedParamKeys]);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(Math.max(dragStartWidth.current + delta, 280), 800);
      setLeftWidth(next);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Initialize params + style state when template changes
  useEffect(() => {
    if (!selectedTemplate) return;
    const palette = selectedTemplate.palette ?? [];
    const defaults: Record<string, string> = {};
    for (const [key, def] of Object.entries(selectedTemplate.params)) {
      const d = def.default;
      defaults[key] = typeof d === 'number'
        ? (palette[d - 1] ?? String(d))
        : (d ?? '');
    }
    setParams(defaults);
    setCurrentPalette([...(selectedTemplate.palette ?? [])]);
    setCurrentDefaults(copyStyleDef(selectedTemplate.defaults));
    const styles: Record<string, StyleDef> = {};
    for (const [key, def] of Object.entries(selectedTemplate.params)) {
      styles[key] = copyStyleDef(def.style);
    }
    setCurrentParamStyles(styles);
  }, [selectedTemplate]);

  // Fetch raw YAML for buildModifiedYaml
  useEffect(() => {
    if (!selectedTemplate) return;
    fetch(`/api/templates/${selectedTemplate.name}`)
      .then(r => r.text())
      .then(setBaseYaml)
      .catch(() => setBaseYaml(''));
  }, [selectedTemplate]);

  // Build preview URL for template mode
  const buildTemplateUrl = useCallback(() => {
    if (!selectedTemplate) return null;
    const q = new URLSearchParams({ template: selectedTemplate.name });
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v);
    }
    return `/api/generate?${q.toString()}`;
  }, [selectedTemplate, params]);

  // Validate and preview for free mode
  const validateYaml = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setValidationError(null);
        return;
      }
      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ yaml: text, params: freeParams }),
        });
        const data = await res.json();
        setValidationError(data.valid ? null : data.error);
      } catch {
        setValidationError('Network error');
      }
    },
    [freeParams]
  );

  // data:URI params are too large for GET URLs → always use POST in that case
  const hasLargeParams = useMemo(
    () => Object.values(params).some((v) => v.startsWith('data:')),
    [params]
  );

  // Update preview: template mode without edits and no large params → immediate GET URL
  useEffect(() => {
    if (tab === 'template' && !hasEdits && !hasLargeParams) {
      setPreviewUrl(buildTemplateUrl());
      if (isMobile) setMobilePanel('preview');
    }
  }, [tab, hasEdits, hasLargeParams, buildTemplateUrl, isMobile]);

  // Update preview: template mode with edits OR large params → debounced POST
  useEffect(() => {
    if (tab !== 'template' || (!hasEdits && !hasLargeParams) || !baseYaml) return;
    const timer = setTimeout(async () => {
      const yamlToUse = hasEdits ? buildModifiedYaml() : baseYaml;
      if (!yamlToUse) return;
      setPreviewUrl(null);
      setIsLoading(true);
      try {
        const res = await fetch('/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ yaml: yamlToUse, params }),
        });
        if (res.ok) {
          const blob = await res.blob();
          setPreviewUrl(URL.createObjectURL(blob));
          if (isMobile) setMobilePanel('preview');
        }
      } finally {
        setIsLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [tab, hasEdits, hasLargeParams, baseYaml, buildModifiedYaml, params, isMobile]);

  useEffect(() => {
    if (tab !== 'free') return;
    const timer = setTimeout(async () => {
      await validateYaml(yamlText);
      if (yamlText.trim()) {
        setPreviewUrl(null);
        setIsLoading(true);
        try {
          const res = await fetch('/api/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yaml: yamlText, params: freeParams }),
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            if (isMobile) setMobilePanel('preview');
          }
        } finally {
          setIsLoading(false);
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [tab, yamlText, freeParams, validateYaml, isMobile]);

  const handleDownload = async () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${selectedTemplate?.name ?? 'slide'}.png`;
    a.click();
  };

  const handleCopyUrl = () => {
    if (tab === 'template') {
      const url = buildTemplateUrl();
      if (url) {
        navigator.clipboard.writeText(window.location.origin + url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    }
  };

  const handleReset = () => {
    if (!selectedTemplate) return;
    setCurrentPalette([...(selectedTemplate.palette ?? [])]);
    setCurrentDefaults(copyStyleDef(selectedTemplate.defaults));
    const styles: Record<string, StyleDef> = {};
    for (const [key, def] of Object.entries(selectedTemplate.params)) {
      styles[key] = copyStyleDef(def.style);
    }
    setCurrentParamStyles(styles);
  };

  const handleCopyToFreeMode = async () => {
    if (!selectedTemplate) return;
    if (baseYaml) {
      setYamlText(buildModifiedYaml());
      setFreeParams({ ...params });
      setTab('free');
      return;
    }
    setCopyToFreeLoading(true);
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.name}`);
      if (!res.ok) throw new Error('Failed to fetch template YAML');
      const raw = await res.text();
      setYamlText(raw);
      setFreeParams({ ...params });
      setTab('free');
    } catch (err: any) {
      console.error(err);
    } finally {
      setCopyToFreeLoading(false);
    }
  };

  const handleExportYaml = () => {
    if (tab !== 'free' || !yamlText) return;
    const blob = new Blob([yamlText], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template.yaml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOgInspect = async () => {
    if (!ogUrl.trim()) return;
    setOgLoading(true);
    setOgError(null);
    setOgData(null);
    try {
      const res = await fetch('/api/og', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ogUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setOgData(json.data);
    } catch (err: any) {
      setOgError(err.message ?? 'Network error');
    } finally {
      setOgLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">Slide Generator</span>
          <span className="text-xs text-gray-500 font-mono">v2</span>
        </div>
        <div className="flex gap-2">
          {tab === 'template' && (
            <button
              onClick={handleCopyUrl}
              disabled={hasLargeParams}
              title={hasLargeParams ? 'URL not shareable (contains embedded image data)' : undefined}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-md transition-colors"
            >
              {copySuccess ? '✓ Copied!' : 'Copy URL'}
            </button>
          )}
          {tab === 'free' && (
            <button
              onClick={handleExportYaml}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
            >
              Export YAML
            </button>
          )}
          {tab !== 'og' && (
            <button
              onClick={handleDownload}
              disabled={!previewUrl}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              ↓ PNG
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Mobile panel toggle */}
        {isMobile && (
          <div className="absolute top-0 left-0 right-0 z-10 flex bg-gray-900 border-b border-gray-800">
            <button
              onClick={() => setMobilePanel('settings')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mobilePanel === 'settings'
                  ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              ⚙ Settings
            </button>
            <button
              onClick={() => setMobilePanel('preview')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mobilePanel === 'preview'
                  ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              🖼 Preview
            </button>
          </div>
        )}

        {/* Left panel */}
        <div
          className={`flex flex-col border-r border-gray-800 min-h-0 shrink-0 ${
            isMobile && mobilePanel !== 'settings' ? 'hidden' : ''
          }`}
          style={isMobile ? { width: '100%', paddingTop: 42 } : { width: leftWidth }}
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setTab('template')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === 'template'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Template
            </button>
            <button
              onClick={() => setTab('free')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === 'free'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Free mode
            </button>
            <button
              onClick={() => setTab('og')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === 'og'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              OG Inspect
            </button>
            <button
              onClick={() => setTab('images')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === 'images'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Image tool
            </button>
          </div>

          {/* Content */}
          <div className={`flex-1 min-h-0 p-4 ${tab === 'free' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
            {tab === 'template' ? (
              <TemplatePanel
                templates={templates}
                selected={selectedTemplate}
                params={params}
                copyToFreeLoading={copyToFreeLoading}
                hasEdits={hasEdits}
                modifiedParamKeys={modifiedParamKeys}
                currentPalette={currentPalette}
                currentDefaults={currentDefaults}
                currentParamStyles={currentParamStyles}
                onSelect={(t) => setSelectedTemplate(t)}
                onParamChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))}
                onCopyToFreeMode={handleCopyToFreeMode}
                onPaletteChange={(palette) => {
                  setCurrentPalette(palette);
                  setParams((prev) => {
                    const next = { ...prev };
                    for (const [key, val] of Object.entries(prev)) {
                      if (!val) continue;
                      const idx = currentPalette.findIndex(
                        (c) => c.toLowerCase() === val.toLowerCase()
                      );
                      if (idx !== -1 && idx < palette.length) {
                        next[key] = palette[idx];
                      }
                    }
                    return next;
                  });
                }}
                onDefaultsChange={setCurrentDefaults}
                onParamStyleChange={(key, style) => setCurrentParamStyles(s => ({ ...s, [key]: style }))}
              />
            ) : tab === 'free' ? (
              <FreeModePanel
                yamlText={yamlText}
                params={freeParams}
                validationError={validationError}
                onYamlChange={setYamlText}
                onParamChange={(k, v) => setFreeParams((p) => ({ ...p, [k]: v }))}
              />
            ) : tab === 'og' ? (
              <OgInputPanel
                url={ogUrl}
                loading={ogLoading}
                error={ogError}
                onUrlChange={setOgUrl}
                onInspect={handleOgInspect}
              />
            ) : (
              <ImagesPanel />
            )}
          </div>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleDividerMouseDown}
          className={`w-1 shrink-0 bg-gray-800 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors ${
            isMobile ? 'hidden' : ''
          }`}
          title="Drag to resize"
        />

        {/* Right panel — preview */}
        <div
          className={`flex-1 flex flex-col bg-gray-950 min-h-0 ${
            tab === 'og'
              ? 'overflow-y-auto p-6 items-center'
              : 'items-center justify-center p-8 overflow-hidden'
          } ${isMobile && mobilePanel !== 'preview' ? 'hidden' : ''}`}
          style={isMobile ? { paddingTop: 42 } : undefined}
        >
          {tab === 'og' ? (
            <OgPreviewPanel data={ogData} url={ogUrl} loading={ogLoading} />
          ) : isLoading ? (
            <div className="text-gray-500 text-sm">Generating…</div>
          ) : previewUrl ? (
            <div className="flex flex-col items-center gap-4 max-w-full">
              <img
                src={previewUrl}
                alt="Slide preview"
                className="max-w-full max-h-full rounded-lg shadow-2xl border border-gray-800"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              />
            </div>
          ) : (
            <div className="text-center text-gray-600">
              <div className="text-4xl mb-3">🖼</div>
              <p className="text-sm">
                {tab === 'template'
                  ? 'Select a template to preview'
                  : 'Enter YAML to generate a preview'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Template Panel ────────────────────────────────────────────────────────────

function TemplatePanel({
  templates,
  selected,
  params,
  copyToFreeLoading,
  hasEdits,
  modifiedParamKeys,
  currentPalette,
  currentDefaults,
  currentParamStyles,
  onSelect,
  onParamChange,
  onCopyToFreeMode,
  onPaletteChange,
  onDefaultsChange,
  onParamStyleChange,
}: {
  templates: TemplateInfo[];
  selected: TemplateInfo | null;
  params: Record<string, string>;
  copyToFreeLoading: boolean;
  hasEdits: boolean;
  modifiedParamKeys: Set<string>;
  currentPalette: string[];
  currentDefaults: StyleDef;
  currentParamStyles: Record<string, StyleDef>;
  onSelect: (t: TemplateInfo) => void;
  onParamChange: (key: string, value: string) => void;
  onCopyToFreeMode: () => void;
  onPaletteChange: (palette: string[]) => void;
  onDefaultsChange: (d: StyleDef) => void;
  onParamStyleChange: (key: string, style: StyleDef) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
          Template
        </label>
        <div className="flex gap-2">
          <select
            value={selected?.name ?? ''}
            onChange={(e) => {
              const t = templates.find((x) => x.name === e.target.value);
              if (t) onSelect(t);
            }}
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={onCopyToFreeMode}
            disabled={!selected || copyToFreeLoading}
            title="Copy this template to Free mode editor"
            className="px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 rounded-md transition-colors whitespace-nowrap"
          >
            {copyToFreeLoading ? '…' : hasEdits ? <span>Edit YAML <span className="text-orange-400">●</span></span> : 'Edit YAML'}
          </button>
        </div>
        {selected?.description && (
          <p className="mt-1.5 text-xs text-gray-500">{selected.description}</p>
        )}
      </div>

      {selected && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Palette</p>
          <div className="flex gap-2 flex-wrap items-end">
            {currentPalette.map((color, i) => (
              <div key={i} className="flex flex-col items-center gap-1 group">
                <div className="relative w-7 h-7 cursor-pointer" title={color}>
                  <div className="w-full h-full rounded border border-gray-600" style={{ backgroundColor: color }} />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const n = [...currentPalette]; n[i] = e.target.value; onPaletteChange(n);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <button
                    onClick={() => onPaletteChange(currentPalette.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-gray-700 text-gray-300 text-[8px] hidden group-hover:flex items-center justify-center hover:bg-red-700 hover:text-white z-10"
                    title="Remove color"
                  >×</button>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">{i + 1}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => onPaletteChange([...currentPalette, '#FFFFFF'])}
                className="w-7 h-7 rounded border border-dashed border-gray-600 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-300 text-base leading-none"
                title="Add color"
              >+</button>
              <span className="text-[10px] text-gray-600 font-mono">add</span>
            </div>
          </div>
          {currentPalette.length > 0 && (
            <p className="text-[10px] text-gray-600 mt-2 font-mono">
              [FG=1]…[/] · [BG=2]…[/] · [ALIGN=center]
            </p>
          )}
        </div>
      )}

      {selected && currentPalette.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Defaults</p>
          <DefaultsPanel defaults={currentDefaults} palette={currentPalette} onDefaultsChange={onDefaultsChange} />
        </div>
      )}

      {selected && Object.keys(selected.params).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Parameters</p>
          {(() => {
            const entries = Object.entries(selected.params);
            const paramKeys = new Set(entries.map(([k]) => k));
            const seen = new Set<string>();
            return entries.map(([key, def]) => {
              if (seen.has(key)) return null;
              // Sub-param: group matches a parent param key → hidden from main list
              if (def.group && paramKeys.has(def.group)) {
                seen.add(key);
                return null;
              }
              // Old group behavior: side-by-side when group name is not a param key
              if (def.group && !paramKeys.has(def.group)) {
                const group = entries.filter(([, d]) => d.group === def.group);
                group.forEach(([k]) => seen.add(k));
                return (
                  <div key={`group-${def.group}`} className="flex gap-2">
                    {group.map(([k, d]) => (
                      <div key={k} className="flex-1 min-w-0">
                        <ParamField
                          paramKey={k}
                          def={d}
                          value={params[k] ?? ''}
                          palette={currentPalette}
                          templateDefaults={currentDefaults}
                          currentStyle={currentParamStyles[k] ?? {}}
                          isValueModified={modifiedParamKeys.has(k)}
                          onChange={(v) => onParamChange(k, v)}
                          onStyleChange={(s) => onParamStyleChange(k, s)}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                );
              }
              // Parent param: collect sub-params whose group === key
              const subParamEntries = entries.filter(([, d]) => d.group === key);
              seen.add(key);
              return (
                <ParamField
                  key={key}
                  paramKey={key}
                  def={def}
                  value={params[key] ?? ''}
                  palette={currentPalette}
                  templateDefaults={currentDefaults}
                  currentStyle={currentParamStyles[key] ?? {}}
                  isValueModified={modifiedParamKeys.has(key)}
                  onChange={(v) => onParamChange(key, v)}
                  onStyleChange={(s) => onParamStyleChange(key, s)}
                  subParams={subParamEntries}
                  subValues={Object.fromEntries(subParamEntries.map(([k]) => [k, params[k] ?? '']))}
                  onSubParamChange={(k, v) => onParamChange(k, v)}
                />
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

function ParamField({
  paramKey,
  def,
  value,
  palette = [],
  templateDefaults,
  currentStyle,
  isValueModified = false,
  onChange,
  onStyleChange,
  compact = false,
  subParams = [],
  subValues = {},
  onSubParamChange,
}: {
  paramKey: string;
  def: ParamDef;
  value: string;
  palette?: string[];
  templateDefaults?: StyleDef;
  currentStyle?: StyleDef;
  isValueModified?: boolean;
  onChange: (v: string) => void;
  onStyleChange?: (style: StyleDef) => void;
  compact?: boolean;
  subParams?: Array<[string, ParamDef]>;
  subValues?: Record<string, string>;
  onSubParamChange?: (key: string, value: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  const inputClass =
    'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-500 placeholder-gray-600';

  return (
    <div
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFocused(false);
      }}
    >
      <label className="flex items-center gap-1.5 text-xs text-gray-300 mb-1">
        <span className="font-mono">{paramKey}</span>
        {def.required && <span className="text-red-400">*</span>}
        {def.type !== 'text' && (
          <span className="text-gray-600 font-mono text-[10px] bg-gray-800 px-1 rounded">
            {def.type}
          </span>
        )}
        {(isValueModified || !deepEqual(currentStyle ?? {}, def.style ?? {})) && (
          <span className="text-orange-400 text-[10px] leading-none">●</span>
        )}
      </label>
      {!compact && def.description && (
        <p className="text-xs text-gray-500 mb-1">{def.description}</p>
      )}

      {def.type === 'boolean' ? (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            className="w-4 h-4 accent-blue-500 cursor-pointer"
          />
          <span className="text-sm text-gray-300">{value === 'true' ? 'true' : 'false'}</span>
        </label>
      ) : def.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={String(def.default || `Enter ${paramKey}…`)}
          className={`${inputClass} resize-y font-mono`}
        />
      ) : def.type === 'color' ? (
        <div className="space-y-1.5">
          {palette.length > 0 && (
            <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
              {palette.map((c, i) => {
                const isActive = value.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={i}
                    onClick={() => onChange(c)}
                    title={`${i + 1} — ${c}`}
                    className={`rounded border-2 transition-all ${compact ? 'w-[18px] h-[18px]' : 'w-6 h-6'} ${
                      isActive ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
          )}
          {palette.length === 0 && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value || '#000000'}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border border-gray-700 bg-gray-800 p-0.5"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={String(def.default || '#000000')}
                className={inputClass}
              />
            </div>
          )}
        </div>
      ) : def.type === 'number' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(def.default || `Enter ${paramKey}…`)}
          className={inputClass}
        />
      ) : def.type === 'url' ? (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(def.default || 'https://…')}
          className={inputClass}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(def.default || `Enter ${paramKey}…`)}
          className={inputClass}
        />
      )}

      {isFocused && (def.style || subParams.length > 0) && (
        <div className="mt-1.5 rounded-md border border-gray-700 bg-gray-900 p-2 space-y-2">
          {subParams.length > 0 && (
            <div className="space-y-1.5">
              {Array.from({ length: Math.ceil(subParams.length / 2) }, (_, i) =>
                subParams.slice(i * 2, i * 2 + 2)
              ).map((pair, i) => (
                <div key={i} className="flex gap-2">
                  {pair.map(([k, d]) => (
                    <div key={k} className="flex-1 min-w-0">
                      <ParamField
                        paramKey={k}
                        def={d}
                        value={subValues[k] ?? ''}
                        palette={palette}
                        onChange={(v) => onSubParamChange?.(k, v)}
                        compact
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {def.style && (
            <StyleInfoPanel
              originalStyle={def.style}
              currentStyle={currentStyle ?? def.style}
              defaults={templateDefaults}
              palette={palette}
              onStyleChange={onStyleChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Defaults Panel ───────────────────────────────────────────────────────────

function DefaultsPanel({
  defaults,
  palette,
  onDefaultsChange,
}: {
  defaults: StyleDef;
  palette: string[];
  onDefaultsChange: (d: StyleDef) => void;
}) {
  const weightOptions = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const inputClass =
    'bg-gray-800 border border-gray-700 text-gray-100 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500 font-mono text-[11px]';

  const updateFont = (updates: Partial<NonNullable<StyleDef['font']>>) => {
    const newFont = { ...(defaults.font ?? {}), ...updates };
    const clean = Object.fromEntries(Object.entries(newFont).filter(([, v]) => v !== undefined)) as StyleDef['font'];
    onDefaultsChange({ ...defaults, font: Object.keys(clean ?? {}).length ? clean : undefined });
  };

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/60 px-3 py-2 text-[11px]">
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 mr-0.5">fg</span>
          {palette.map((c, i) => (
            <button
              key={i}
              onClick={() => onDefaultsChange({ ...defaults, fg: defaults.fg === i + 1 ? undefined : i + 1 })}
              title={`${i + 1} — ${c}`}
              className={`w-[18px] h-[18px] rounded border-2 transition-all ${
                defaults.fg === i + 1 ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">font</span>
          <input
            type="text"
            value={defaults.font?.name ?? ''}
            onChange={(e) => updateFont({ name: e.target.value || undefined })}
            className={`${inputClass} w-32`}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">size</span>
          <input
            type="number"
            value={defaults.font?.size ?? ''}
            onChange={(e) => updateFont({ size: e.target.value ? Number(e.target.value) : undefined })}
            className={`${inputClass} w-14`}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">weight</span>
          <select
            value={defaults.font?.weight ?? ''}
            onChange={(e) => updateFont({ weight: e.target.value ? Number(e.target.value) : undefined })}
            className={inputClass}
          >
            <option value="">—</option>
            {weightOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Style Info Panel ─────────────────────────────────────────────────────────

function StyleInfoPanel({
  originalStyle,
  currentStyle,
  defaults,
  palette,
  onStyleChange,
}: {
  originalStyle: StyleDef;
  currentStyle: StyleDef;
  defaults?: StyleDef;
  palette: string[];
  onStyleChange?: (style: StyleDef) => void;
}) {
  const td = defaults ?? {};
  const ps = currentStyle;

  const isOverridden = (curr: any, def: any) => curr !== undefined && curr !== def;
  const weightOptions = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const inputClass =
    'bg-gray-800 border border-gray-700 text-gray-100 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500 font-mono text-[11px]';

  const update = (updates: Partial<StyleDef>) => onStyleChange?.({ ...ps, ...updates });
  const updateFont = (updates: Partial<NonNullable<StyleDef['font']>>) => {
    const newFont = { ...(ps.font ?? {}), ...updates };
    const clean = Object.fromEntries(Object.entries(newFont).filter(([, v]) => v !== undefined)) as StyleDef['font'];
    onStyleChange?.({ ...ps, font: Object.keys(clean ?? {}).length ? clean : undefined });
  };

  const fg = ps.fg !== undefined ? ps.fg : td.fg;
  const bg = ps.bg;

  return (
    <div className="mt-1.5 rounded border border-gray-700 bg-gray-900/60 px-2 py-2 text-[11px] space-y-1.5">
      {/* fg */}
      <div className="flex items-center gap-2">
        <span className={`w-10 shrink-0 ${isOverridden(ps.fg, td.fg) ? 'text-amber-400' : 'text-gray-500'}`}>
          {isOverridden(ps.fg, td.fg) && <span className="mr-0.5 opacity-60">✱</span>}fg
        </span>
        <div className="flex gap-1 flex-wrap">
          {palette.map((c, i) => (
            <button
              key={i}
              onClick={() => update({ fg: ps.fg === i + 1 ? undefined : i + 1 })}
              title={`${i + 1} — ${c}`}
              className={`w-[18px] h-[18px] rounded border-2 transition-all ${
                fg === i + 1 ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* bg */}
      <div className="flex items-center gap-2">
        <span className={`w-10 shrink-0 ${bg !== undefined ? 'text-amber-400' : 'text-gray-500'}`}>
          {bg !== undefined && <span className="mr-0.5 opacity-60">✱</span>}bg
        </span>
        <div className="flex gap-1 flex-wrap">
          {palette.map((c, i) => (
            <button
              key={i}
              onClick={() => update({ bg: bg === i + 1 ? undefined : i + 1 })}
              title={`${i + 1} — ${c}`}
              className={`w-[18px] h-[18px] rounded border-2 transition-all ${
                bg === i + 1 ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* font name */}
      <div className="flex items-center gap-2">
        <span className={`w-10 shrink-0 ${isOverridden(ps.font?.name, td.font?.name) ? 'text-amber-400' : 'text-gray-500'}`}>
          {isOverridden(ps.font?.name, td.font?.name) && <span className="mr-0.5 opacity-60">✱</span>}font
        </span>
        <input
          type="text"
          value={ps.font?.name ?? ''}
          placeholder={td.font?.name ?? ''}
          onChange={(e) => updateFont({ name: e.target.value || undefined })}
          className={`${inputClass} w-36`}
        />
      </div>

      {/* size */}
      <div className="flex items-center gap-2">
        <span className={`w-10 shrink-0 ${isOverridden(ps.font?.size, td.font?.size) ? 'text-amber-400' : 'text-gray-500'}`}>
          {isOverridden(ps.font?.size, td.font?.size) && <span className="mr-0.5 opacity-60">✱</span>}size
        </span>
        <input
          type="number"
          value={ps.font?.size ?? ''}
          placeholder={String(td.font?.size ?? '')}
          onChange={(e) => updateFont({ size: e.target.value ? Number(e.target.value) : undefined })}
          className={`${inputClass} w-16`}
        />
      </div>

      {/* weight */}
      <div className="flex items-center gap-2">
        <span className={`w-10 shrink-0 ${isOverridden(ps.font?.weight, td.font?.weight) ? 'text-amber-400' : 'text-gray-500'}`}>
          {isOverridden(ps.font?.weight, td.font?.weight) && <span className="mr-0.5 opacity-60">✱</span>}weight
        </span>
        <select
          value={ps.font?.weight ?? ''}
          onChange={(e) => updateFont({ weight: e.target.value ? Number(e.target.value) : undefined })}
          className={inputClass}
        >
          <option value="">—</option>
          {weightOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* split */}
      {(originalStyle.split !== undefined || ps.split !== undefined) && (
        <div className="flex items-center gap-2">
          <span className={`w-10 shrink-0 ${isOverridden(ps.split, td.split) ? 'text-amber-400' : 'text-gray-500'}`}>
            {isOverridden(ps.split, td.split) && <span className="mr-0.5 opacity-60">✱</span>}split
          </span>
          <input
            type="checkbox"
            checked={ps.split ?? false}
            onChange={(e) => update({ split: e.target.checked })}
            className="w-3 h-3 accent-blue-500 cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}

// ── OG Inspect Panel (left) ───────────────────────────────────────────────────

function OgInputPanel({
  url,
  loading,
  error,
  onUrlChange,
  onInspect,
}: {
  url: string;
  loading: boolean;
  error: string | null;
  onUrlChange: (v: string) => void;
  onInspect: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
          URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onInspect(); }}
            placeholder="https://example.com"
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
          <button
            onClick={onInspect}
            disabled={loading || !url.trim()}
            className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors whitespace-nowrap"
          >
            {loading ? '…' : 'Inspect'}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-400 font-mono bg-red-900/20 p-2 rounded">
          {error}
        </p>
      )}
    </div>
  );
}

// ── OG Preview Panel (right) ──────────────────────────────────────────────────

function OgPropertyGroup({
  label,
  color,
  props,
}: {
  label: string;
  color: 'blue' | 'sky' | 'gray';
  props: [string, string][];
}) {
  const keyColor =
    color === 'blue'
      ? 'text-blue-400'
      : color === 'sky'
      ? 'text-sky-400'
      : 'text-gray-400';
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="rounded-lg border border-gray-800 overflow-hidden">
        {props.map(([key, value], i) => (
          <div
            key={key}
            className={`flex gap-3 px-3 py-2 text-xs ${
              i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/40'
            }`}
          >
            <span className={`font-mono shrink-0 w-40 truncate ${keyColor}`} title={key}>
              {key}
            </span>
            <span className="text-gray-300 break-all min-w-0">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OgPreviewPanel({
  data,
  url,
  loading,
}: {
  data: Record<string, string> | null;
  url: string;
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-gray-500 text-sm">Fetching…</div>;
  }

  if (!data) {
    return (
      <div className="text-center text-gray-600">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm">Enter a URL to inspect its Open Graph tags</p>
      </div>
    );
  }

  const image = data['og:image'] || data['twitter:image'];
  const title = data['og:title'] || data['twitter:title'] || data['title'] || 'No title';
  const description = data['og:description'] || data['twitter:description'];
  const siteName = data['og:site_name'];
  let domain = '';
  try { domain = new URL(url).hostname; } catch { /* noop */ }

  const ogProps = Object.entries(data).filter(([k]) => k.startsWith('og:')) as [string, string][];
  const twitterProps = Object.entries(data).filter(([k]) => k.startsWith('twitter:')) as [string, string][];
  const otherProps = Object.entries(data).filter(
    ([k]) => !k.startsWith('og:') && !k.startsWith('twitter:')
  ) as [string, string][];

  return (
    <div className="w-full max-w-2xl space-y-6 py-2">
      {/* Social card */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Preview</p>
        <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
          {image && (
            <img src={image} alt={title} className="w-full object-cover" />
          )}
          <div className="p-4">
            <p className="text-xs text-gray-500 uppercase mb-1">{siteName || domain}</p>
            <p className="text-sm font-semibold text-gray-100 leading-snug">{title}</p>
            {description && (
              <p className="text-xs text-gray-400 mt-1.5">{description}</p>
            )}
            {domain && (
              <p className="text-xs text-gray-600 mt-2">{domain}</p>
            )}
          </div>
        </div>
      </div>

      {ogProps.length > 0 && (
        <OgPropertyGroup label="Open Graph" color="blue" props={ogProps} />
      )}
      {twitterProps.length > 0 && (
        <OgPropertyGroup label="Twitter / X" color="sky" props={twitterProps} />
      )}
      {otherProps.length > 0 && (
        <OgPropertyGroup label="Other" color="gray" props={otherProps} />
      )}
    </div>
  );
}

// ── Free Mode Panel ───────────────────────────────────────────────────────────

function FreeModePanel({
  yamlText,
  params,
  validationError,
  onYamlChange,
  onParamChange,
}: {
  yamlText: string;
  params: Record<string, string>;
  validationError: string | null;
  onYamlChange: (v: string) => void;
  onParamChange: (k: string, v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(true);
  const [copiedParam, setCopiedParam] = useState<string | null>(null);

  const filledParams = Object.entries(params).filter(([, v]) => v.trim());

  const handleCopy = () => {
    if (!yamlText) return;
    navigator.clipboard.writeText(yamlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyParam = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedParam(key);
    setTimeout(() => setCopiedParam(null), 2000);
  };

  return (
    <div className="space-y-3 flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 uppercase tracking-wide">YAML Editor</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!yamlText}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 rounded transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          {validationError ? (
            <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded">
              Invalid
            </span>
          ) : yamlText ? (
            <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
              Valid
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <YamlEditor value={yamlText} onChange={onYamlChange} />
      </div>

      {validationError && (
        <p className="text-xs text-red-400 font-mono bg-red-900/20 p-2 rounded">
          {validationError}
        </p>
      )}

      {/* Parameters section — shows values substituted into {{ placeholders }} */}
      {filledParams.length > 0 && (
        <div className="shrink-0 border border-gray-700 rounded-md overflow-hidden">
          <button
            onClick={() => setParamsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-800 hover:bg-gray-750 text-left"
          >
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Parameters <span className="text-gray-500 normal-case">({filledParams.length})</span>
            </span>
            <span className="text-gray-500 text-xs">{paramsOpen ? '▲' : '▼'}</span>
          </button>
          {paramsOpen && (
            <div className="divide-y divide-gray-800">
              {filledParams.map(([key, value]) => {
                const isDataUri = value.startsWith('data:');
                const mimeMatch = isDataUri ? value.match(/^data:([^;,]+)/) : null;
                const displayValue = isDataUri
                  ? `[${mimeMatch?.[1] ?? 'data'} · ${Math.round(value.length / 1024)} KB]`
                  : value;
                return (
                  <div key={key} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900">
                    <span className="font-mono text-[11px] text-blue-400 shrink-0 w-28 truncate" title={key}>
                      {key}
                    </span>
                    {isDataUri ? (
                      <span className="flex-1 text-xs text-gray-500 font-mono truncate" title={displayValue}>
                        {displayValue}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => onParamChange(key, e.target.value)}
                        className="flex-1 bg-transparent border-0 text-xs text-gray-300 font-mono focus:outline-none min-w-0 truncate"
                      />
                    )}
                    <button
                      onClick={() => handleCopyParam(key, value)}
                      className="shrink-0 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                      title="Copy value"
                    >
                      {copiedParam === key ? '✓' : 'copy'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Images Panel ──────────────────────────────────────────────────────────────

function ImagesPanel({}: {
  params?: Record<string, string>;
  paramDefs?: Record<string, import('@/lib/types').ParamDef>;
  onParamChange?: (key: string, value: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [converting, setConverting] = useState(false);
  const [dataUri, setDataUri] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDataUri = dataUri.startsWith('data:');
  const mimeMatch = isDataUri ? dataUri.match(/^data:([^;]+)/) : null;
  const mime = mimeMatch ? mimeMatch[1] : null;

  const handleConvert = async () => {
    if (!url.trim()) return;
    setConverting(true);
    setError('');
    setDataUri('');
    try {
      const res = await fetch(`/api/img-convert?url=${encodeURIComponent(url.trim())}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDataUri(json.dataUri);
    } catch (err: any) {
      setError(err.message ?? 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setDataUri('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result !== 'string') return;
      setDataUri(result);
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsDataURL(file);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(dataUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setDataUri('');
    setError('');
    setUrl('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* URL input */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConvert(); }}
            placeholder="https://…"
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
          <button
            onClick={handleConvert}
            disabled={converting || !url.trim()}
            className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors whitespace-nowrap"
          >
            {converting ? '…' : '→ data:URI'}
          </button>
        </div>
      </div>

      {/* File upload */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Upload image</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600 cursor-pointer"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 font-mono bg-red-900/20 p-2 rounded">{error}</p>
      )}

      {/* Result */}
      {dataUri && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-2">
          {mime && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono bg-gray-800 text-green-400 px-1.5 py-0.5 rounded">
                {mime}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {Math.round(dataUri.length / 1024)} kb
              </span>
            </div>
          )}

          <div className="flex justify-center bg-gray-800 rounded p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUri}
              alt="preview"
              className="max-h-40 max-w-full object-contain"
            />
          </div>

          <p className="text-[10px] text-gray-600 font-mono truncate">
            {dataUri.slice(0, 60)}…
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 px-2 py-1.5 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy data:URI'}
            </button>
            <button
              onClick={handleClear}
              className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
