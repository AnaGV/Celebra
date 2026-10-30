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

  // TODO: enviar email a OWNER_EMAIL con Resend para verificar el pago.

  return json({ ok: true, ref: body.ref });
};
