/**
 * POST /api/codigo — el checkout pregunta si un código de descuento vale.
 * La respuesta solo dice "vale / no vale" y el monto: la lista de códigos vive en tu Google Sheet.
 * Con tarjeta o PayPal, Lemon Squeezy vuelve a validar el código al cobrar (un solo uso, vencimiento).
 * Con Binance o Pago Móvil, el código se marca como usado cuando confirmas el pago en n8n.
 */
import { callN8n, json, type N8nEnv } from './_n8n';

export const onRequestPost: PagesFunction<N8nEnv> = async ({ request, env }) => {
  let body: { codigo?: string; producto?: string };
  try {
    body = await request.json();
  } catch {
    return json({ valido: false, mensaje: 'Código inválido' }, 400);
  }
  const codigo = String(body.codigo ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (codigo.length < 6 || codigo.length > 20) return json({ valido: false, mensaje: 'Ese código no existe. Revísalo en tu email.' });

  try {
    const { data } = await callN8n(env, 'codigo/validar', { codigo, producto: body.producto ?? '' });
    if (data.valido === true) {
      return json({ valido: true, codigo, descuento_usd: Number(data.descuento_usd) || 0, vence: data.vence });
    }
    return json({ valido: false, mensaje: String(data.mensaje ?? 'Ese código no es válido.') });
  } catch {
    return json({ valido: false, mensaje: 'No pudimos revisar el código ahora. Inténtalo de nuevo.' }, 502);
  }
};
