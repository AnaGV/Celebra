/**
 * POST /api/orders — recibe pagos manuales (Binance, Pago Móvil) y reservas en el local.
 * Corre como Cloudflare Pages Function.
 *
 * Próximos pasos (fase 2):
 *  - Guardar el pedido en D1 (binding DB).
 *  - Avisarte por email (Resend) y confirmar al cliente.
 *  - Binance: un Cron Trigger cruza pedidos pendientes con tu historial de Binance Pay
 *    (API key de SOLO LECTURA en una variable secreta) y entrega el ebook automáticamente.
 */

interface Env {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  OWNER_EMAIL?: string;
}

type OrderBody = {
  ref: string;
  productId: string;
  country: string;
  method: 'binance' | 'pago_movil' | 'pagar_en_local';
  amountUsd: number;
  listPriceUsd?: number;
  codigo?: string;
  email?: string;
  name?: string;
  phone?: string;
  binanceOrderId?: string;
  bankReference?: string;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: OrderBody;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  const methods = ['binance', 'pago_movil', 'pagar_en_local'];
  if (!/^(EB|LF)-[A-Z2-9]{5}$/.test(body.ref ?? '')) return json({ ok: false, error: 'Referencia inválida' }, 400);
  if (!methods.includes(body.method)) return json({ ok: false, error: 'Método inválido' }, 400);
  if (body.method === 'binance' && !body.binanceOrderId) return json({ ok: false, error: 'Falta el ID de la orden de Binance' }, 400);
  if (body.method === 'pago_movil' && !body.bankReference) return json({ ok: false, error: 'Falta la referencia bancaria' }, 400);
  const codigo = String(body.codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
  // El código se vuelve a revisar cuando confirmas el pago en n8n (formulario "Confirmar pago manual").

  // El país real según Cloudflare, útil para detectar inconsistencias.
  const cfCountry = (request as Request & { cf?: { country?: string } }).cf?.country ?? null;

  if (env.DB) {
    await env.DB.prepare(
      `INSERT INTO orders (ref, product_id, method, country, cf_country, amount_usd, email, name, phone, binance_order_id, bank_reference, codigo, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pendiente', datetime('now'))`,
    )
      .bind(
        body.ref, body.productId, body.method, body.country, cfCountry, body.amountUsd,
        body.email ?? null, body.name ?? null, body.phone ?? null, body.binanceOrderId ?? null, body.bankReference ?? null, codigo,
      )
      .run();
  }

  // Sin n8n todavía: el pedido se guarda en R2 y te llega un correo para verificar el pago y enviar el libro.
  const pedido = { ...body, codigo, cfCountry, creado: new Date().toISOString(), estado: 'pendiente' };
  const e = env as any;
  try { await e.FOTOS?.put(`pedidos/${body.ref}.json`, JSON.stringify(pedido), { httpMetadata: { contentType: 'application/json' } }); } catch {}
  try { await avisarPedido(e, pedido); } catch {}
  return json({ ok: true, ref: body.ref });
};

function b64(t: string) { let o = ''; for (const b of new TextEncoder().encode(t)) o += String.fromCharCode(b); return btoa(o).replace(/.{1,76}/g, '$&\r\n'); }
const enc = (t: string) => { let o = ''; for (const b of new TextEncoder().encode(t)) o += String.fromCharCode(b); return `=?UTF-8?B?${btoa(o)}?=`; };

/** Correo a Celebra con todo lo necesario para verificar el pago y mandar el libro. */
async function avisarPedido(env: any, p: any) {
  if (!env.CONTACTO) return;
  const metodo = p.method === 'pago_movil' ? 'Pago Móvil' : p.method === 'binance' ? 'Binance' : 'Pagar en el local';
  const lineas = [
    `Nuevo pedido ${p.ref} por ${metodo}. Verifica el pago y envía el libro.`, '',
    `Producto: ${p.productId}`, `Monto: USD ${p.amountUsd}`,
    `Nombre: ${p.name || '-'}`, `Correo: ${p.email || '-'}`, `Teléfono: ${p.phone || '-'}`,
    p.method === 'pago_movil' ? `Referencia bancaria: ${p.bankReference}` : '',
    p.method === 'binance' ? `ID de orden Binance: ${p.binanceOrderId}` : '',
    p.codigo ? `Código de descuento: ${p.codigo}` : '',
    `País elegido: ${p.country || '-'} · País según Cloudflare: ${p.cfCountry || '-'}`, '',
    'Cuando confirmes el pago, respóndele a este correo con el PDF (responder le escribe al cliente).',
  ].filter((l) => l !== '');
  const desde = 'contacto@somoscelebrave.com';
  const para = env.CONTACTO_DESTINO || 'somoscelebra.ve@gmail.com';
  const okMail = typeof p.email === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(p.email);
  const raw = [
    `From: ${enc('Celebra · Pedidos')} <${desde}>`, `To: <${para}>`,
    ...(okMail ? [`Reply-To: <${p.email}>`] : []),
    `Subject: ${enc(`Pedido ${p.ref} · ${metodo} · USD ${p.amountUsd}`)}`,
    `Message-ID: <${crypto.randomUUID()}@somoscelebrave.com>`, `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(lineas.join('\n')),
  ].join('\r\n');
  // @ts-ignore módulo propio de Cloudflare Workers
  const { EmailMessage } = await import('cloudflare:email');
  await env.CONTACTO.send(new EmailMessage(desde, para, raw));
}
