import { NextRequest } from 'next/server';
import { computeShareId, saveShare, loadShare } from '@/lib/share-store';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  const data = await loadShare(id);
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(data);
}

export async function POST(req: NextRequest) {
  let params: Record<string, string>;
  try {
    params = await req.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return Response.json({ error: 'Expected object' }, { status: 400 });
  }
  const id = computeShareId(params);
  await saveShare(id, params);
  return Response.json({ id });
}
