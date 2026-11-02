import { NextRequest } from 'next/server';
import { listShares, deleteShare } from '@/lib/share-store';

const ID_RE = /^[0-9a-f]{16}$/;

function checkAuth(req: NextRequest): 'ok' | 'missing' | 'unauthorized' {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return 'missing';
  return req.headers.get('authorization') === `Bearer ${secret}` ? 'ok' : 'unauthorized';
}

export async function GET(req: NextRequest) {
  const auth = checkAuth(req);
  if (auth === 'missing') return Response.json({ error: 'Admin not configured' }, { status: 503 });
  if (auth === 'unauthorized') return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const metas = await listShares();
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('host') ?? 'localhost:3000';
  const base = process.env.APP_URL ?? `${proto}://${host}`;
  const shares = metas.map(({ id, createdAt }) => ({ id, createdAt, view: `${base}/view/${id}` }));
  return Response.json({ count: shares.length, shares });
}

export async function DELETE(req: NextRequest) {
  const auth = checkAuth(req);
  if (auth === 'missing') return Response.json({ error: 'Admin not configured' }, { status: 503 });
  if (auth === 'unauthorized') return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { id } = body;
  if (!id || !ID_RE.test(id)) {
    return Response.json({ error: 'Invalid id (expected 16 hex chars)' }, { status: 400 });
  }

  await deleteShare(id);
  return Response.json({ deleted: true, id });
}
