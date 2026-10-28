import crypto from 'crypto';

export function computeShareId(params: Record<string, string>): string {
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(params).sort()));
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function useUpstash(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.USE_UPSTASH === 'true';
}

export async function saveShare(id: string, params: Record<string, string>): Promise<void> {
  if (!useUpstash()) {
    const { writeFileSync, mkdirSync } = await import('fs');
    const { join } = await import('path');
    const dir = join(process.cwd(), 'shares');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(params), 'utf8');
  } else {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
    await redis.set(`share:${id}`, params);
  }
}

export async function loadShare(id: string): Promise<Record<string, string> | null> {
  if (!useUpstash()) {
    const { existsSync, readFileSync } = await import('fs');
    const { join } = await import('path');
    const file = join(process.cwd(), 'shares', `${id}.json`);
    if (!existsSync(file)) return null;
    try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
  } else {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
    return await redis.get<Record<string, string>>(`share:${id}`);
  }
}
