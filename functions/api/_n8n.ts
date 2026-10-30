/**
 * Ayudas compartidas por las funciones que hablan con n8n.
 * Las URLs de n8n y la clave nunca llegan al navegador: viven como variables secretas en Cloudflare.
 */

export interface N8nEnv {
  N8N_BASE_URL?: string; // https://n8n.TU-DOMINIO.com
  CELEBRA_FORM_KEY?: string; // la misma clave que CELEBRA_FORM_KEY en el VPS de n8n
  TURNSTILE_SECRET?: string; // opcional: anti-bots de Cloudflare
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function callN8n(env: N8nEnv, path: string, body: unknown) {
  if (!env.N8N_BASE_URL || !env.CELEBRA_FORM_KEY) throw new Error('n8n no configurado');
  const res = await fetch(`${env.N8N_BASE_URL.replace(/\/$/, '')}/webhook/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-celebra-key': env.CELEBRA_FORM_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data as Record<string, unknown> };
}

/** Verifica el token de Cloudflare Turnstile si configuraste TURNSTILE_SECRET. */
export async function turnstileOk(env: N8nEnv, token: unknown, ip: string | null) {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean };
  return out.success === true;
}
