/**
 * POST /api/lead — formulario "Lee el capítulo de presupuesto gratis".
 * Valida, frena bots y pasa el lead a n8n, que crea el código único,
 * guarda el lead en Google Sheets, envía el email y avisa a Meta.
 */
import { callN8n, json, turnstileOk, type N8nEnv } from './_n8n';

type LeadBody = { nombre?: string; email?: string; pais?: string; utm?: string; event_id?: string; empresa?: string; turnstile?: string };

export const onRequestPost: PagesFunction<N8nEnv> = async ({ request, env }) => {
  let body: LeadBody;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  // Campo trampa: las personas no lo ven; los bots lo llenan.
  if (body.empresa) return json({ ok: true });

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || email.length > 120) {
    return json({ ok: false, error: 'Revisa tu email.' }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip');
  if (!(await turnstileOk(env, body.turnstile, ip))) return json({ ok: false, error: 'No pudimos verificar que no eres un robot.' }, 400);

  // País real según Cloudflare: decide el idioma de los montos y la zona horaria del email.
  const cf = (request as Request & { cf?: { country?: string } }).cf?.country;
  const pais = cf === 'VE' || cf === 'CL' ? cf : body.pais === 'VE' || body.pais === 'CL' ? body.pais : 'OT';

  try {
    const { status, data } = await callN8n(env, 'lead', {
      nombre: String(body.nombre ?? '').slice(0, 60),
      email,
      pais,
      utm: String(body.utm ?? '').slice(0, 120),
      event_id: String(body.event_id ?? '').slice(0, 80),
    });
    if (status >= 400) return json({ ok: false, error: 'Revisa tu email.' }, 400);
    return json({ ok: true, reenviado: Boolean(data.reenviado) });
  } catch {
    return json({ ok: false, error: 'No pudimos enviarlo ahora. Inténtalo en unos minutos.' }, 502);
  }
};
