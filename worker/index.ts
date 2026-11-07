/**
 * Worker de Celebra (Cloudflare Workers con archivos estáticos).
 * - /api/*  → las mismas funciones de functions/api (lead, código, pedidos).
 * - todo lo demás → la página estática generada por Astro (carpeta dist).
 */
import { onRequestPost as lead } from '../functions/api/lead';
import { onRequestPost as codigo } from '../functions/api/codigo';
import { onRequestPost as orders } from '../functions/api/orders';
import { subirFoto, verFoto } from './foto';

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
    if (url.pathname === '/api/foto') {
      if (request.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { allow: 'POST' } });
      return subirFoto(request, env);
    }
    if (url.pathname.startsWith('/ref/')) return verFoto(request, env, url.pathname.slice(5).replace(/\/$/, ''));
    if (url.pathname === '/api/pais') {
      const c = (request as any).cf?.country ?? request.headers.get('cf-ipcountry') ?? '';
      const pais = c === 'VE' ? 'VE' : c === 'CL' ? 'CL' : 'OTRO';
      return new Response(JSON.stringify({ pais }), { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
    }
    if (url.pathname.startsWith('/api/')) return new Response('No encontrado', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
