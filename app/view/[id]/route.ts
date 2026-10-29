import { headers } from 'next/headers';
import { type NextRequest } from 'next/server';
import { loadShare } from '@/lib/share-store';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const storedParams = await loadShare(id);
  if (!storedParams) {
    return new Response('Share not found', { status: 404 });
  }

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
  const rawProto = headersList.get('x-forwarded-proto') ?? '';
  const proto = /^https?$/.test(rawProto) ? rawProto : (host.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const { _og_title, _og_description, _og_url } = storedParams;
  const imageUrl = `${baseUrl}/api/generate-share/${id}`;
  const pageUrl = `${baseUrl}/view/${id}`;
  const editUrl = `/?_share=${id}`;
  const title = _og_title || 'Slide';
  const safeOgUrl = _og_url && isSafeUrl(_og_url) ? _og_url : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta property="og:site_name"     content="Slide Generator"/>
  <meta property="og:type"         content="website"/>
  <meta property="og:url"          content="${esc(pageUrl)}"/>
  <meta property="og:title"        content="${esc(title)}"/>
  ${_og_description ? `<meta property="og:description" content="${esc(_og_description)}"/>` : ''}
  <meta name="referrer" content="no-referrer"/>
  <meta property="og:image"        content="${esc(imageUrl)}"/>
  ${proto === 'https' ? `<meta property="og:image:secure_url" content="${esc(imageUrl)}"/>` : ''}
  <meta property="og:image:type"   content="image/png"/>
  <meta property="og:image:width"  content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card"        content="summary_large_image"/>
  <meta name="twitter:title"       content="${esc(title)}"/>
  ${_og_description ? `<meta name="twitter:description" content="${esc(_og_description)}"/>` : ''}
  <meta name="twitter:image"       content="${esc(imageUrl)}"/>
</head>
<body style="margin:0;background:#030712;color:#f3f4f6;font-family:system-ui,sans-serif;min-height:100vh">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.5rem;background:#111827;border-bottom:1px solid #1f2937">
    <a href="/" style="font-size:1.125rem;font-weight:600;color:#fff;text-decoration:none">Slide Generator</a>
    <div style="display:flex;align-items:center;gap:.5rem">
      <a href="${esc(editUrl)}" style="padding:.375rem .75rem;font-size:.75rem;background:#1f2937;color:#d1d5db;border-radius:.375rem;text-decoration:none">Éditer</a>
      <a href="${esc(imageUrl)}" download="${esc(title)}.png" style="padding:.375rem .75rem;font-size:.75rem;background:#2563eb;color:#fff;border-radius:.375rem;text-decoration:none">↓ PNG</a>
    </div>
  </header>
  <main style="max-width:896px;margin:0 auto;padding:2rem 1.5rem">
    <img src="${esc(imageUrl)}" alt="${esc(title)}" style="width:100%;border-radius:.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)"/>
    ${safeOgUrl ? `<p style="margin-top:1rem;text-align:center;font-size:.875rem;color:#9ca3af">
      Source&nbsp;:&nbsp;<a href="${esc(safeOgUrl)}" rel="nofollow noopener noreferrer" target="_blank" style="color:#60a5fa;text-decoration:underline">${esc(safeOgUrl)}</a>
    </p>` : ''}
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
