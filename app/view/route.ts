import { headers } from 'next/headers';
import { type NextRequest } from 'next/server';

// Encodes < > & " but NOT ' — single quotes don't need escaping in double-quoted HTML attributes.
// React over-encodes ' as &#x27;, which breaks some OG parsers. This function avoids that.
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  sp.forEach((v, k) => { params[k] = v; });

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
  const rawProto = headersList.get('x-forwarded-proto') ?? '';
  const proto = /^https?$/.test(rawProto) ? rawProto : (host.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const { _og_title, _og_description, _og_url, ...templateParams } = params;
  const imageUrl = `${baseUrl}/api/generate?${new URLSearchParams(templateParams).toString()}`;
  const editUrl = `/?${new URLSearchParams(params).toString()}`;
  const title = _og_title || params.title || 'Slide';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta property="og:title" content="${esc(title)}"/>
  ${_og_description ? `<meta property="og:description" content="${esc(_og_description)}"/>` : ''}
  ${_og_url        ? `<meta property="og:url"         content="${esc(_og_url)}"/>` : ''}
  <meta property="og:image"        content="${esc(imageUrl)}"/>
  <meta property="og:image:type"   content="image/png"/>
  <meta property="og:image:width"  content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:type"         content="website"/>
  <meta name="twitter:card"        content="summary_large_image"/>
  <meta name="twitter:title"       content="${esc(title)}"/>
  ${_og_description ? `<meta name="twitter:description" content="${esc(_og_description)}"/>` : ''}
  <meta name="twitter:image"       content="${esc(imageUrl)}"/>
</head>
<body style="margin:0;background:#030712;color:#f3f4f6;font-family:system-ui,sans-serif;min-height:100vh">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.5rem;background:#111827;border-bottom:1px solid #1f2937">
    <a href="/" style="font-size:1.125rem;font-weight:600;color:#fff;text-decoration:none">Slide Generator</a>
    <a href="${esc(editUrl)}" style="padding:.375rem .75rem;font-size:.75rem;background:#2563eb;color:#fff;border-radius:.375rem;text-decoration:none">Éditer</a>
  </header>
  <main style="max-width:896px;margin:0 auto;padding:2rem 1.5rem">
    <img src="${esc(imageUrl)}" alt="${esc(title)}" style="width:100%;border-radius:.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)"/>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
