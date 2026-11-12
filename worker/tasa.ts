/**
 * GET /api/tasa → { tasa, fecha } con el dólar oficial BCV (Bs por USD).
 * Fuente: ve.dolarapi.com (toma el valor del BCV). Se guarda en R2 4 horas;
 * si la fuente falla, se usa lo guardado hasta 3 días. Si no hay nada, { tasa: null }
 * y la página pide pagar "a la tasa BCV del día".
 */
const KEY = 'privado/tasa-bcv.json';
const FRESCO = 4 * 3600e3, MAXIMO = 3 * 86400e3;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' } });

export async function tasaBcv(env: any): Promise<Response> {
  let guardada: any = null;
  try { const o = await env.FOTOS?.get(KEY); if (o) guardada = await o.json(); } catch {}
  if (guardada && Date.now() - guardada.leida < FRESCO) return json({ tasa: guardada.tasa, fecha: guardada.fecha });
  try {
    const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { headers: { accept: 'application/json' }, cf: { cacheTtl: 900 } } as any);
    if (r.ok) {
      const d: any = await r.json();
      const tasa = Number(d?.promedio ?? d?.venta ?? d?.compra);
      if (tasa > 0) {
        const f = d?.fechaActualizacion ? new Date(d.fechaActualizacion) : null;
        const fecha = f && !isNaN(+f) ? f.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', timeZone: 'America/Caracas' }) : '';
        const nueva = { tasa: Math.round(tasa * 100) / 100, fecha, leida: Date.now() };
        await env.FOTOS?.put(KEY, JSON.stringify(nueva), { httpMetadata: { contentType: 'application/json' } });
        return json({ tasa: nueva.tasa, fecha });
      }
    }
  } catch {}
  if (guardada && Date.now() - guardada.leida < MAXIMO) return json({ tasa: guardada.tasa, fecha: guardada.fecha });
  return json({ tasa: null });
}
