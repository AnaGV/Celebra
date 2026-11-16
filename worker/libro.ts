/**
 * Capítulo gratis y códigos de descuento del libro, sin n8n.
 *
 * POST /api/lead   → guarda el contacto, crea un código y envía el capítulo por correo (Resend).
 * POST /api/codigo → el checkout pregunta si un código vale.
 *
 * Códigos:
 *  - Con LEMON_API_KEY: código único FIESTAxxxxxx, 1 uso, vence en 48 h, creado también en Lemon Squeezy
 *    (así vale con tarjeta/PayPal) y guardado en R2 (así vale con Pago Móvil/Binance).
 *  - Sin LEMON_API_KEY: el código compartido de src/config/lemon.ts (creado a mano en Lemon Squeezy).
 *
 * R2: leads/<huella>.json · codigos/<CODIGO>.json
 * Secretos: RESEND_API_KEY (obligatorio para enviar), LEMON_API_KEY (opcional), TURNSTILE_SECRET (opcional).
 */
import { lemon } from '../src/config/lemon';
import { mainProduct } from '../src/config/products';
import { huella, estaDeBaja } from './baja';
import { turnstileOk } from '../functions/api/_n8n';
import { plantilla, enviarCorreo } from './correo';

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const DOM = 'https://somoscelebrave.com';
const PDF = `${DOM}/regalo/capitulo-2-presupuesto.pdf`;

type Codigo = { codigo: string; email?: string; creado: string; vence: string | null; usado: boolean; lemon: boolean; pct: number };

function nuevoCodigo() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'FIESTA' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => abc[b % abc.length]).join('');
}

const descuentoUsd = (pct: number) => Math.round(mainProduct.priceUsd * pct) / 100;

/** Crea el descuento en Lemon Squeezy. Devuelve true si quedó creado. */
async function crearEnLemon(env: any, codigo: string, vence: Date): Promise<boolean> {
  if (!env.LEMON_API_KEY) return false;
  try {
    const r = await fetch('https://api.lemonsqueezy.com/v1/discounts', {
      method: 'POST',
      headers: { accept: 'application/vnd.api+json', 'content-type': 'application/vnd.api+json', authorization: `Bearer ${env.LEMON_API_KEY}` },
      body: JSON.stringify({ data: {
        type: 'discounts',
        attributes: {
          name: `Capítulo gratis ${codigo}`, code: codigo, amount: lemon.descuentoPct, amount_type: 'percent',
          is_limited_to_products: true, is_limited_redemptions: true, max_redemptions: 1, expires_at: vence.toISOString(),
        },
        relationships: {
          store: { data: { type: 'stores', id: lemon.storeId } },
          variants: { data: [{ type: 'variants', id: lemon.variantId }] },
        },
      } }),
    });
    return r.ok;
  } catch { return false; }
}

export function correoCapitulo(nombre: string, codigo: string, vence: Date | null) {
  const venceTxt = vence ? `Es personal, sirve una sola vez y vence el ${vence.toLocaleString('es-VE', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' })} (hora de Venezuela).` : 'Úsalo cuando quieras comprar el libro completo.';
  const libro = `${DOM}/libro/?codigo=${encodeURIComponent(codigo)}&utm_source=capitulo2&utm_medium=email&utm_campaign=lead`;
  const html = plantilla({
    previa: 'Tu capítulo de regalo y un descuento para el libro completo.',
    imagen: { src: `${DOM}/img/correo/capitulo.jpg`, alt: 'Capítulo de regalo: el presupuesto de la fiesta' },
    titulo: nombre ? `¡Hola, ${nombre}! Aquí está tu capítulo 🎉` : '¡Aquí está tu capítulo! 🎉',
    parrafos: [
      'Gracias por pedir el capítulo de regalo de <b>Fiestas que se recuerdan</b>.',
      'Te enseña a armar el presupuesto real de la fiesta: cuánto gastar en cada cosa, un ejemplo completo y una plantilla para imprimir.',
    ],
    boton: { texto: 'Descargar el capítulo (PDF)', url: PDF },
    destacado: codigo ? { etiqueta: `Tu código para el libro completo (${lemon.descuentoPct}% menos)`, valor: codigo, nota: venceTxt, enlace: { texto: 'Usar mi código ahora', url: libro } } : undefined,
    nota: '¿Dudas? Responde este correo y te leemos. Yenny y Ana, del taller de Caripe.',
    pie: 'Recibes este correo porque pediste el capítulo gratis en nuestra web',
  });
  const texto = `${nombre ? 'Hola, ' + nombre : 'Hola'}\n\nAquí está tu capítulo de regalo de Fiestas que se recuerdan:\n${PDF}\n\n${codigo ? `Tu código para el libro completo (${lemon.descuentoPct}% menos): ${codigo}\n${venceTxt}\nÚsalo aquí: ${libro}\n\n` : ''}Si tienes dudas, responde este correo.\nYenny y Ana · Celebra, Caripe`;
  return { html, texto };
}

export async function lead(request: Request, env: any): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);
  let b: any; try { b = await request.json(); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
  if (b.empresa) return json({ ok: true }); // trampa para bots
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 120) return json({ ok: false, error: 'Revisa tu email.' }, 400);
  if (!(await turnstileOk(env, b.turnstile, request.headers.get('cf-connecting-ip')))) return json({ ok: false, error: 'No pudimos verificar que no eres un robot.' }, 400);
  if (!env.FOTOS || !env.RESEND_API_KEY) return json({ ok: false, error: 'No pudimos enviarlo ahora. Inténtalo en unos minutos.' }, 503);

  const nombre = String(b.nombre ?? '').trim().slice(0, 60);
  const key = `leads/${await huella(email)}.json`;
  const ahora = new Date();
  let previo: any = null; try { const o = await env.FOTOS.get(key); if (o) previo = await o.json(); } catch {}

  // Si ya lo pidió y su código sigue vigente, se le reenvía el mismo (no se regalan códigos nuevos).
  let codigo = '', vence: Date | null = null, reenviado = false;
  if (previo?.codigo) {
    const c = await leerCodigo(env, previo.codigo);
    if (c && !c.usado && (!c.vence || Date.parse(c.vence) > ahora.getTime())) { codigo = c.codigo; vence = c.vence ? new Date(c.vence) : null; reenviado = true; }
  }
  if (!codigo && !previo?.codigo) {
    vence = new Date(ahora.getTime() + lemon.horasCodigo * 3600e3);
    const nuevo = nuevoCodigo();
    if (await crearEnLemon(env, nuevo, vence)) {
      codigo = nuevo;
      await guardarCodigo(env, { codigo, email, creado: ahora.toISOString(), vence: vence.toISOString(), usado: false, lemon: true, pct: lemon.descuentoPct });
    } else if (lemon.codigoCompartido) {
      codigo = lemon.codigoCompartido; vence = null;
    }
  }

  const { html, texto } = correoCapitulo(nombre, codigo, vence);
  try { await enviarCorreo(env, email, 'Tu capítulo de regalo: el presupuesto de la fiesta 🎉', html, texto); }
  catch { return json({ ok: false, error: 'No pudimos enviarlo ahora. Inténtalo en unos minutos.' }, 502); }

  const cf = (request as any).cf?.country;
  await env.FOTOS.put(key, JSON.stringify({
    email, nombre: nombre || previo?.nombre || '', pais: cf || b.pais || '', origen: b.origen === 'regalo' ? 'regalo' : 'landing',
    utm: String(b.utm ?? '').slice(0, 120), codigo: codigo || previo?.codigo || '', creado: previo?.creado || ahora.toISOString(),
    ultimoEnvio: ahora.toISOString(), envios: (previo?.envios || 0) + 1, baja: await estaDeBaja(env, email),
  }), { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true, reenviado });
}

async function leerCodigo(env: any, codigo: string): Promise<Codigo | null> {
  if (!/^[A-Z0-9]{6,20}$/.test(codigo)) return null;
  try { const o = await env.FOTOS?.get(`codigos/${codigo}.json`); return o ? await o.json() : null; } catch { return null; }
}
async function guardarCodigo(env: any, c: Codigo) {
  await env.FOTOS.put(`codigos/${c.codigo}.json`, JSON.stringify(c), { httpMetadata: { contentType: 'application/json' } });
}

/** Marca un código como usado (al confirmar un pago por Pago Móvil o Binance). */
export async function usarCodigo(env: any, codigo: string) {
  const c = await leerCodigo(env, codigo);
  if (c && !c.usado) { c.usado = true; await guardarCodigo(env, c); }
}

export async function validarCodigo(request: Request, env: any): Promise<Response> {
  if (request.method !== 'POST') return json({ valido: false }, 405);
  let b: any; try { b = await request.json(); } catch { return json({ valido: false, mensaje: 'Código inválido' }, 400); }
  const codigo = String(b.codigo ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const no = (mensaje = 'Ese código no existe. Revísalo en tu email.') => json({ valido: false, mensaje });
  if (codigo.length < 6 || codigo.length > 20) return no();
  if (lemon.codigoCompartido && codigo === lemon.codigoCompartido) return json({ valido: true, codigo, descuento_usd: descuentoUsd(lemon.descuentoPct), vence: null });
  const c = await leerCodigo(env, codigo);
  if (!c) return no();
  if (c.usado) return no('Ese código ya se usó.');
  if (c.vence && Date.parse(c.vence) < Date.now()) return no('Ese código ya venció.');
  return json({ valido: true, codigo, descuento_usd: descuentoUsd(c.pct), vence: c.vence });
}
