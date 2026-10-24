import { loadTemplate, parseTemplate, expandSpecialElements } from '@/lib/loader';
import { loadFonts } from '@/lib/fonts';
import { ImageResponse } from 'next/og';

// GET /api/preview?template=simple&title=Hello  → PNG (alias of /api/generate)
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const templateName = url.searchParams.get('template');
  if (!templateName) {
    return new Response(JSON.stringify({ error: 'Missing template' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== 'template') params[key] = value;
  }

  try {
    const template = loadTemplate(templateName, params);
    const fonts = await loadFonts(template.fonts);
    const element = expandSpecialElements(template.element, template.palette, template.params, template.defaults);
    return new ImageResponse(element as any, {
      width: template.output.width,
      height: template.output.height,
      fonts,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/preview  { yaml, params }  → PNG from raw YAML (free mode)
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { yaml: yamlStr, params = {} } = body as {
      yaml: string;
      params?: Record<string, string>;
    };

    const template = parseTemplate(yamlStr, params);
    const fonts = await loadFonts(template.fonts);
    const element = expandSpecialElements(template.element, template.palette, template.params, template.defaults);
    return new ImageResponse(element as any, {
      width: template.output.width,
      height: template.output.height,
      fonts,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
