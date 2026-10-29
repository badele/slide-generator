import { type NextRequest } from 'next/server';
import { loadShare } from '@/lib/share-store';
import { parseTemplate, expandSpecialElements } from '@/lib/loader';
import { loadAllFonts } from '@/lib/fonts';
import { ImageResponse } from 'next/og';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stored = await loadShare(id);
  if (!stored) {
    return new Response('Share not found', { status: 404 });
  }

  try {
    const { _template, _overlay, _og_title: _t, _og_description: _d, _og_url: _u } = stored;
    if (!_template) return new Response('Invalid share: missing _template', { status: 400 });

    let overlay: Record<string, string> = {};
    try { overlay = _overlay ? JSON.parse(_overlay) : {}; } catch { /* ignore */ }
    const template = parseTemplate(_template, overlay);

    const fonts = await loadAllFonts();
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
