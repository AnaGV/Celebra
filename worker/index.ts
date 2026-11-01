/**
 * Worker de Celebra (Cloudflare Workers con archivos estáticos).
 * - /api/*  → las mismas funciones de functions/api (lead, código, pedidos).
 * - todo lo demás → la página estática generada por Astro (carpeta dist).
 */
import { onRequestPost as lead } from '../functions/api/lead';
import { onRequestPost as codigo } from '../functions/api/codigo';
import { onRequestPost as orders } from '../functions/api/orders';

const rutas: Record<string, (ctx: any) => Promise<Response> | Response> = {
  '/api/lead': lead,
  '/api/codigo': codigo,
  '/api/orders': orders,
};

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const handler = rutas[url.pathname];
    if (handler) {
      if (request.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { allow: 'POST' } });
      return handler({ request, env, waitUntil: ctx.waitUntil.bind(ctx), params: {}, data: {} });
    }
    if (url.pathname.startsWith('/api/')) return new Response('No encontrado', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
