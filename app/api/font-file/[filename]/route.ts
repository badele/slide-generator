import { readFileSync } from 'fs';
import { join } from 'path';
import { type NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Only allow safe filenames (alphanumeric, dashes, spaces, underscores, dots)
  if (!/^[\w\-. ]+\.(?:ttf|otf)$/i.test(filename)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = readFileSync(join(process.cwd(), 'resources/fonts', filename));
    return new Response(data, {
      headers: {
        'Content-Type': 'font/ttf',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
