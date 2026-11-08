/**
 * Bajas definitivas de correos de Celebra.
 *
 * Quien se da de baja NO vuelve a recibir correos de marketing, nunca más.
 * Se guarda solo una huella (SHA-256) del correo en R2 (bajas/<huella>), no el correo en texto.
 * La lista no caduca: la regla de borrado del bucket solo afecta a ref/ (fotos).
 *
 * POST /api/baja           { email, borrar }  → registra la baja (público, desde /baja)
 * GET  /api/baja/estado?e= (cabecera x-celebra-key) → { baja: true|false } para n8n antes de cada envío
 */

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const normalizar = (e: string) => e.trim().toLowerCase();
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function huella(email: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizar(email)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function estaDeBaja(env: any, email: string): Promise<boolean> {
  if (!env.FOTOS || !EMAIL.test(normalizar(email))) return false;
  return (await env.FOTOS.head(`bajas/${await huella(email)}`)) !== null;
}

export async function registrarBaja(request: Request, env: any): Promise<Response> {
  if (!env.FOTOS) return json({ error: 'No disponible' }, 503);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origen no permitido' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 2000) return json({ error: 'Muy grande' }, 413);
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; borrar?: unknown };
  const email = typeof body.email === 'string' ? normalizar(body.email) : '';
  if (!EMAIL.test(email)) return json({ error: 'Escribe un correo válido' }, 400);
  await env.FOTOS.put(`bajas/${await huella(email)}`, '', {
    customMetadata: { fecha: new Date().toISOString(), borrar: body.borrar ? 'si' : 'no' },
  });
  return json({ ok: true });
}

export async function consultarBaja(request: Request, env: any): Promise<Response> {
  const key = request.headers.get('x-celebra-key');
  if (!env.CELEBRA_FORM_KEY || key !== env.CELEBRA_FORM_KEY) return json({ error: 'No autorizado' }, 401);
  const e = new URL(request.url).searchParams.get('e') || '';
  if (!EMAIL.test(normalizar(e))) return json({ error: 'Correo no válido' }, 400);
  const obj = env.FOTOS ? await env.FOTOS.head(`bajas/${await huella(e)}`) : null;
  return json({ baja: obj !== null, borrar: obj?.customMetadata?.borrar === 'si' });
}
