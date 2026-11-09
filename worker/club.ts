/**
 * Club Celebra: la gente registra fechas importantes (cumpleaños, aniversarios…) y
 * Celebra les escribe antes con una oferta.
 *
 * POST /api/club  → guarda el registro en R2 (club/<huella del correo>.json) y avisa por correo al negocio.
 * Cron diario     → manda al correo del negocio la lista de fechas que vienen en 7 y 30 días.
 *
 * Se guarda lo mínimo: nombre y contacto de quien se registra; de cada fecha solo el primer nombre,
 * la relación y el día/mes (sin año, sin apellidos, sin fotos). Quien se da de baja se borra del club.
 */
import { huella, estaDeBaja } from './baja';

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const txt = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n\0]/g, ' ').trim().slice(0, max);
import { RELACIONES, TIPOS } from '../src/config/club';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Fecha = { nombre: string; relacion: string; tipo: string; dia: number; mes: number };
type Registro = { nombre: string; email: string; whatsapp: string; fechas: Fecha[]; alta: string; codigo?: string; nombres?: string[] };

function nuevoCodigo() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(5));
  return 'CLUB-' + [...r].map((x) => abc[x % abc.length]).join('');
}

function b64(s: string) { let o = ''; for (const b of new TextEncoder().encode(s)) o += String.fromCharCode(b); return btoa(o).replace(/.{1,76}/g, '$&\r\n'); }
const enc = (t: string) => { let o = ''; for (const b of new TextEncoder().encode(t)) o += String.fromCharCode(b); return `=?UTF-8?B?${btoa(o)}?=`; };

async function correoNegocio(env: any, asunto: string, cuerpo: string, replyTo?: string) {
  if (!env.CONTACTO) return;
  const desde = 'contacto@somoscelebrave.com';
  const para = env.CONTACTO_DESTINO || 'somoscelebra.ve@gmail.com';
  const raw = [
    `From: ${enc('Celebra · Club')} <${desde}>`, `To: <${para}>`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${enc(asunto)}`, `Message-ID: <${crypto.randomUUID()}@somoscelebrave.com>`, `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(cuerpo),
  ].join('\r\n');
  const { EmailMessage } = await import('cloudflare:email');
  await env.CONTACTO.send(new EmailMessage(desde, para, raw));
}

const linea = (f: Fecha) => `${f.tipo} de ${f.nombre} (${f.relacion}) — ${f.dia} de ${MESES[f.mes - 1]}`;

export async function registrarClub(request: Request, env: any): Promise<Response> {
  if (!env.FOTOS) return json({ error: 'No disponible' }, 503);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origen no permitido' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 6000) return json({ error: 'Muy grande' }, 413);
  const b = (await request.json().catch(() => ({}))) as Record<string, any>;
  if (txt(b.empresa, 50)) return json({ ok: true });
  if (Number(b.t || 0) && Date.now() - Number(b.t) < 3000) return json({ ok: true });

  const nombre = txt(b.nombre, 60);
  const email = txt(b.email, 120).toLowerCase();
  const whatsapp = txt(b.whatsapp, 30).replace(/[^\d+ ]/g, '');
  if (!nombre || !EMAIL.test(email)) return json({ error: 'Escribe tu nombre y un correo válido.' }, 400);
  if (b.acepto !== true) return json({ error: 'Necesitamos tu permiso para escribirte.' }, 400);

  const fechas: Fecha[] = (Array.isArray(b.fechas) ? b.fechas : []).slice(0, 5).map((f: any) => ({
    nombre: txt(f?.nombre, 30).split(' ')[0],
    relacion: RELACIONES.includes(f?.relacion) ? f.relacion : 'Otro',
    tipo: TIPOS.includes(f?.tipo) ? f.tipo : 'Cumpleaños',
    dia: Math.round(Number(f?.dia)), mes: Math.round(Number(f?.mes)),
  })).filter((f: Fecha) => f.nombre && f.mes >= 1 && f.mes <= 12 && f.dia >= 1 && f.dia <= 31);
  if (!fechas.length) return json({ error: 'Agrega al menos una fecha.' }, 400);

  const key = `club/${await huella(email)}.json`;
  // Un solo código de 10% por correo: si vuelve a registrarse, conserva su código (no recibe otro).
  const previo = (await (await env.FOTOS.get(key))?.json().catch(() => null)) as Registro | null;
  const repite = !!previo?.codigo;
  const codigo = previo?.codigo || nuevoCodigo();
  const nombres = [...new Set([...(previo?.nombres || (previo ? [previo.nombre] : [])), nombre])].slice(-10);
  const reg: Registro = { nombre, email, whatsapp, fechas, alta: previo?.alta || new Date().toISOString(), codigo, nombres };
  await env.FOTOS.put(key, JSON.stringify(reg), { httpMetadata: { contentType: 'application/json' } });

  const otroNombre = repite && previo && previo.nombre.toLowerCase() !== nombre.toLowerCase();
  try {
    await correoNegocio(env, `${repite ? 'Actualizó sus fechas' : 'Nuevo en el Club'}: ${nombre} · código ${codigo}`,
      `${repite ? 'Volvió a registrarse (mismo correo, MISMO código: no se le da otro 10%).' : 'Se registró en el Club Celebra.'}\n\nNombre: ${nombre}\nCorreo: ${email}\nWhatsApp: ${whatsapp || '-'}\nCódigo de 10%: ${codigo} (válido para UNA compra)\n` +
      (otroNombre ? `\n⚠️ Ojo: antes se registró con el nombre "${previo!.nombre}". Revisa que sea la misma persona.\n` : '') +
      `\nFechas:\n${fechas.map((f) => '• ' + linea(f)).join('\n')}\n\nTe avisaremos por correo 30 y 7 días antes de cada fecha.`, email);
  } catch (e) { console.error('club aviso', (e as Error).message); }
  return json({ ok: true, codigo, repite });
}

export async function borrarDelClub(env: any, email: string) {
  if (env.FOTOS) await env.FOTOS.delete(`club/${await huella(email)}.json`);
}

/** Cron diario: fechas que caen dentro de 30 días y de 7 días (hora de Venezuela). */
export async function resumenDiario(env: any) {
  if (!env.FOTOS) return;
  const ahora = new Date(Date.now() - 4 * 3600 * 1000); // America/Caracas (UTC-4)
  const en = (dias: number) => { const d = new Date(ahora); d.setUTCDate(d.getUTCDate() + dias); return { dia: d.getUTCDate(), mes: d.getUTCMonth() + 1 }; };
  const objetivos = [{ dias: 7, ...en(7) }, { dias: 30, ...en(30) }];
  const avisos: Record<number, string[]> = { 7: [], 30: [] };
  let cursor: string | undefined;
  do {
    const l = await env.FOTOS.list({ prefix: 'club/', cursor });
    for (const o of l.objects) {
      const r = (await (await env.FOTOS.get(o.key))?.json().catch(() => null)) as Registro | null;
      if (!r) continue;
      if (await estaDeBaja(env, r.email)) { await env.FOTOS.delete(o.key); continue; }
      for (const f of r.fechas) for (const ob of objetivos) {
        if (f.dia === ob.dia && f.mes === ob.mes) {
          avisos[ob.dias].push(`• ${linea(f)}\n   Contactar a: ${r.nombre} · ${r.whatsapp ? 'WhatsApp ' + r.whatsapp + ' · ' : ''}${r.email}`);
        }
      }
    }
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  if (!avisos[7].length && !avisos[30].length) return;
  const partes: string[] = [];
  if (avisos[7].length) partes.push(`EN 7 DÍAS — escríbeles hoy con una oferta:\n\n${avisos[7].join('\n\n')}`);
  if (avisos[30].length) partes.push(`EN 30 DÍAS — buen momento para el primer mensaje:\n\n${avisos[30].join('\n\n')}`);
  await correoNegocio(env, `Club Celebra: ${avisos[7].length + avisos[30].length} fecha(s) por celebrar`,
    partes.join('\n\n────────\n\n') + '\n\nRecuerda: escríbeles solo con ofertas para esa fecha. Si alguien pide no recibir más mensajes, regístralo en somoscelebrave.com/baja.');
}
