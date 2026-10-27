import { Playground } from '@/components/Playground';
import type { TemplateInfo } from '@/lib/types';

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
  const [templates, params] = await Promise.all([getTemplates(), searchParams]);
  return <Playground templates={templates} initialParams={params} />;
}
