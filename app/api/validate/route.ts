import { parseTemplate } from '@/lib/loader';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { yaml: yamlStr, params = {} } = body as {
      yaml: string;
      params?: Record<string, string>;
    };

    if (!yamlStr) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing yaml field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    parseTemplate(yamlStr, params);
    return new Response(JSON.stringify({ valid: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ valid: false, error: err.message ?? 'Parse error' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}
