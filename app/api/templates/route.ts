import { listTemplates, loadTemplate } from '@/lib/loader';
import type { TemplateInfo } from '@/lib/types';

export async function GET(): Promise<Response> {
  try {
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

    return new Response(JSON.stringify(templates), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
