import { NextRequest } from 'next/server';

function extractMeta(html: string): Record<string, string> {
  const data: Record<string, string> = {};

  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 10000);

  const metaRe = /<meta\s([^>]+?)(?:\s*\/)?>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(head)) !== null) {
    const attr = m[1];
    const nameM = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(attr);
    const contentM = /content\s*=\s*["']([^"']*?)["']/i.exec(attr);
    if (nameM && contentM) {
      data[nameM[1]] = contentM[1];
    }
  }

  const titleM = /<title[^>]*>([^<]+)<\/title>/i.exec(head);
  if (titleM) data['title'] = titleM[1].replace(/\s+/g, ' ').trim();

  return data;
}

export async function POST(req: NextRequest): Promise<Response> {
  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!url || !/^https?:\/\//i.test(url)) {
    return Response.json(
      { error: 'URL must start with http:// or https://' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SlideGenerator-OGInspector/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json(
        { error: `HTTP ${res.status} — ${res.statusText}` },
        { status: 502 }
      );
    }

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html')) {
      return Response.json(
        { error: `Not an HTML page (content-type: ${ct})` },
        { status: 422 }
      );
    }

    const html = await res.text();
    const data = extractMeta(html);
    return Response.json({ data });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? 'Failed to fetch URL' },
      { status: 502 }
    );
  }
}
