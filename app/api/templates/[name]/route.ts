import { loadTemplateRaw } from '@/lib/loader';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  try {
    const { name } = await params;
    const raw = loadTemplateRaw(name);
    return new Response(raw, {
      headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Template not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
