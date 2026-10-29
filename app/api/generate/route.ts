import { ImageResponse } from 'next/og';
import { loadTemplate, expandSpecialElements } from '@/lib/loader';
import { loadAllFonts } from '@/lib/fonts';

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const templateName = searchParams.get('template');

    if (!templateName) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: template' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const params: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'template') params[key] = value;
    }

    const template = loadTemplate(templateName, params);
    const fonts = await loadAllFonts();
    const element = expandSpecialElements(template.element, template.palette, template.params, template.defaults);
    return new ImageResponse(element as any, {
      width: template.output.width,
      height: template.output.height,
      fonts,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { template: templateName, params = {} } = body as {
      template: string;
      params?: Record<string, string>;
    };

    if (!templateName) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: template' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const template = loadTemplate(templateName, params);
    const fonts = await loadAllFonts();
    const element = expandSpecialElements(template.element, template.palette, template.params, template.defaults);
    return new ImageResponse(element as any, {
      width: template.output.width,
      height: template.output.height,
      fonts,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
