import { Playground } from '@/components/Playground';
import GalleryPage from '@/components/GalleryPage';
import type { TemplateInfo, FontDef } from '@/lib/types';

async function getTemplates(): Promise<TemplateInfo[]> {
  try {
    const { listTemplates, loadTemplate } = await import('@/lib/loader');

    const names = listTemplates();
    const templates: TemplateInfo[] = [];

    for (const name of names) {
      try {
        const template = loadTemplate(name);
        templates.push({
          name: template.name,
          description: template.description,
          params: template.params,
          palette: template.palette ?? [],
          defaults: template.defaults,
          output: template.output,
          fonts: template.fonts,
        });
      } catch {
        // Skip invalid templates
      }
    }
    return templates;
  } catch {
    return [];
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { listAllFontDefs } = await import('@/lib/fonts');
  const [templates, rawParams, allFontDefs] = await Promise.all([
    getTemplates(),
    searchParams,
    Promise.resolve(listAllFontDefs()),
  ]);

  if (!rawParams.template && !rawParams._share) {
    return <GalleryPage templates={templates} />;
  }

  let initialParams: Record<string, string> = rawParams;

  if (rawParams._share) {
    const { loadShare } = await import('@/lib/share-store');
    const { parseTemplate } = await import('@/lib/loader');
    const stored = await loadShare(rawParams._share);
    if (stored?._template) {
      let overlay: Record<string, string> = {};
      try { overlay = stored._overlay ? JSON.parse(stored._overlay) : {}; } catch { /* ignore */ }
      try {
        const parsed = parseTemplate(stored._template, {});
        const customTemplate: TemplateInfo = {
          name: 'custom',
          description: parsed.description || 'Template personnalisé',
          params: parsed.params,
          palette: parsed.palette ?? [],
          defaults: parsed.defaults,
          output: parsed.output,
          fonts: parsed.fonts,
          yaml: stored._template,
        };
        templates.unshift(customTemplate);
        initialParams = {
          template: 'custom',
          ...overlay,
          ...(stored._og_title       ? { _og_title:       stored._og_title }       : {}),
          ...(stored._og_description ? { _og_description: stored._og_description } : {}),
          ...(stored._og_url         ? { _og_url:         stored._og_url }         : {}),
        };
      } catch { /* invalid YAML — fall through to default */ }
    }
  }

  return <Playground templates={templates} initialParams={initialParams} availableFonts={allFontDefs} />;
}
