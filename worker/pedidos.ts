/**
 * Pedidos del libro pagados por Pago Móvil, Binance o en el local (los de tarjeta/PayPal los entrega Lemon Squeezy).
 *
 * Admin (cabecera x-celebra-key = CELEBRA_ADMIN_KEY):
 *   GET  /api/admin/pedidos                 → lista de pedidos (R2 pedidos/*.json)
 *   POST /api/admin/pedidos/<ref>           { accion: 'confirmar' | 'rechazar' | 'reabrir' | 'reenviar' }
 *   PUT  /api/admin/libro                   (cuerpo = el PDF) → guarda el libro en R2 privado/libro/fiestas.pdf
 *   GET  /api/admin/libro                   → { subido, bytes, fecha }
 * Público:
 *   GET  /descarga/<token>                  → el PDF del libro, con enlace personal (14 días, 10 descargas)
 *
 * El PDF del libro NUNCA va en el repositorio ni en la web pública: solo en R2 privado y por enlace personal.
 */
import { usarCodigo } from './libro';
import { plantilla, enviarCorreo, esc } from './correo';

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const LIBRO = 'privado/libro/fiestas.pdf';
const DOM = 'https://somoscelebrave.com';
const REF = /^[A-Z]{2}-[A-Z0-9]{5}$/;
const DIAS = 14, MAX_DESCARGAS = 10;

function igual(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function autorizado(request: Request, env: any): Response | null {
  const clave = String(env.CELEBRA_ADMIN_KEY || '');
  if (clave.length < 10) return json({ error: 'Falta configurar CELEBRA_ADMIN_KEY en Cloudflare' }, 503);
  if (!igual(request.headers.get('x-celebra-key') || '', clave)) return json({ error: 'Clave incorrecta' }, 401);
  return null;
}
const token = () => [...crypto.getRandomValues(new Uint8Array(18))].map((b) => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 57]).join('');

async function leer(env: any, key: string) { try { const o = await env.FOTOS.get(key); return o ? await o.json() : null; } catch { return null; } }
async function guardar(env: any, key: string, v: unknown) { await env.FOTOS.put(key, JSON.stringify(v), { httpMetadata: { contentType: 'application/json' } }); }

export function correoLibro(nombre: string, enlace: string, ref: string) {
  const html = plantilla({
    previa: 'Confirmamos tu pago: aquí está tu libro.',
    imagen: { src: `${DOM}/img/correo/libro.jpg`, alt: 'Fiestas que se recuerdan' },
    titulo: nombre ? `¡Listo, ${nombre}! Aquí está tu libro 🎉` : '¡Listo! Aquí está tu libro 🎉',
    parrafos: [
      'Confirmamos tu pago. Gracias por confiar en Celebra.',
      'Descarga <b>Fiestas que se recuerdan</b> y guárdalo en tu teléfono o computador para tenerlo siempre a mano.',
    ],
    boton: { texto: 'Descargar mi libro (PDF)', url: enlace },
    nota: `El enlace es personal y funciona durante ${DIAS} días. Código de pedido: <b>${esc(ref)}</b>.<br>¿Dudas? Responde este correo y te leemos. Yenny y Ana, del taller de Caripe.`,
    pie: 'Recibes este correo porque compraste nuestro libro',
  });
  const texto = `${nombre ? 'Hola, ' + nombre : 'Hola'}\n\nConfirmamos tu pago. Descarga tu libro Fiestas que se recuerdan aquí:\n${enlace}\n\nEl enlace es personal y funciona ${DIAS} días. Código de pedido: ${ref}.\nYenny y Ana · Celebra, Caripe`;
  return { html, texto };
}

export async function adminPedidos(request: Request, env: any, ref?: string): Promise<Response> {
  const no = autorizado(request, env); if (no) return no;
  if (!ref && request.method === 'GET') {
    const out: any[] = []; let cursor: string | undefined;
    do {
      const l = await env.FOTOS.list({ prefix: 'pedidos/', cursor });
      for (const o of l.objects) { const p = await leer(env, o.key); if (p) out.push(p); }
      cursor = l.truncated ? l.cursor : undefined;
    } while (cursor);
    out.sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
    return json({ pedidos: out, libro: Boolean(await env.FOTOS.head(LIBRO)), resend: Boolean(env.RESEND_API_KEY) });
  }
  if (!ref || !REF.test(ref) || request.method !== 'POST') return json({ error: 'Pedido no válido' }, 400);
  const key = `pedidos/${ref}.json`;
  const p: any = await leer(env, key);
  if (!p) return json({ error: 'No encontramos ese pedido' }, 404);
  const b: any = await request.json().catch(() => ({}));
  const ahora = new Date().toISOString();

  if (b.accion === 'rechazar') { p.estado = 'rechazado'; p.actualizado = ahora; await guardar(env, key, p); return json({ ok: true, pedido: p }); }
  if (b.accion === 'reabrir') { p.estado = 'pendiente'; p.actualizado = ahora; await guardar(env, key, p); return json({ ok: true, pedido: p }); }
  if (b.accion !== 'confirmar' && b.accion !== 'reenviar') return json({ error: 'Acción no válida' }, 400);

  // Libro impreso (retiro en el local): solo se marca confirmado; el retiro se coordina por WhatsApp.
  if (p.productId !== 'ebook-fiestas') {
    p.estado = 'confirmado'; p.actualizado = ahora; await guardar(env, key, p);
    if (p.codigo) await usarCodigo(env, p.codigo);
    return json({ ok: true, pedido: p, aviso: 'Confirmado. Coordina el retiro por WhatsApp.' });
  }
  if (!(await env.FOTOS.head(LIBRO))) return json({ error: 'Primero sube el PDF del libro (abajo en esta página).' }, 409);
  if (!p.email) return json({ error: 'Este pedido no tiene correo. Envíale el libro por WhatsApp.' }, 409);

  const t = token();
  await guardar(env, `descargas/${t}.json`, { ref, vence: new Date(Date.now() + DIAS * 86400e3).toISOString(), usos: 0 });
  const { html, texto } = correoLibro(p.name || '', `${DOM}/descarga/${t}`, ref);
  try { await enviarCorreo(env, p.email, 'Tu libro Fiestas que se recuerdan 🎉', html, texto); }
  catch (e) { return json({ error: (e as Error).message }, 502); }
  p.estado = 'confirmado'; p.actualizado = ahora; p.enviado = ahora; p.envios = (p.envios || 0) + 1;
  await guardar(env, key, p);
  if (p.codigo) await usarCodigo(env, p.codigo);
  return json({ ok: true, pedido: p, aviso: `Libro enviado a ${p.email}.` });
}

export async function adminLibro(request: Request, env: any): Promise<Response> {
  const no = autorizado(request, env); if (no) return no;
  if (request.method === 'GET') {
    const h = await env.FOTOS.head(LIBRO);
    return json({ subido: Boolean(h), bytes: h?.size || 0, fecha: h?.uploaded || null });
  }
  if (request.method !== 'PUT') return json({ error: 'Método no permitido' }, 405);
  const buf = await request.arrayBuffer();
  const ini = new TextDecoder().decode(buf.slice(0, 5));
  if (ini !== '%PDF-' || buf.byteLength > 50 * 1024 * 1024) return json({ error: 'Eso no parece un PDF (o pesa más de 50 MB).' }, 400);
  await env.FOTOS.put(LIBRO, buf, { httpMetadata: { contentType: 'application/pdf' } });
  return json({ ok: true, bytes: buf.byteLength });
}

export async function descarga(env: any, t: string): Promise<Response> {
  const pagina = (titulo: string, txt: string, s = 404) => new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo} · Celebra</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px;color:#16171a"><h1 style="font-size:22px">${titulo}</h1><p style="line-height:1.5">${txt}</p><p><a href="https://wa.me/56945167340" style="color:#db3978;font-weight:bold">Escríbenos por WhatsApp</a></p></body></html>`, { status: s, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  if (!/^[A-Za-z0-9]{18}$/.test(t)) return pagina('Enlace no válido', 'Revisa que el enlace esté completo.');
  const key = `descargas/${t}.json`;
  const d: any = await leer(env, key);
  if (!d) return pagina('Enlace no válido', 'Revisa que el enlace esté completo.');
  if (Date.parse(d.vence) < Date.now() || d.usos >= MAX_DESCARGAS) return pagina('Este enlace ya venció', 'Escríbenos con tu código de pedido y te mandamos uno nuevo.', 410);
  const o = await env.FOTOS.get(LIBRO);
  if (!o) return pagina('Estamos preparando tu libro', 'Inténtalo de nuevo en unos minutos.', 503);
  d.usos += 1; await guardar(env, key, d);
  return new Response(o.body, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="Fiestas-que-se-recuerdan.pdf"', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' } });
}
