/**
 * Worker de Celebra (Cloudflare Workers con archivos estáticos).
 * - /api/*  → las mismas funciones de functions/api (lead, código, pedidos).
 * - todo lo demás → la página estática generada por Astro (carpeta dist).
 */
import { onRequestPost as lead } from '../functions/api/lead';
import { onRequestPost as codigo } from '../functions/api/codigo';
import { onRequestPost as orders } from '../functions/api/orders';
import { subirFoto, verFoto, borrarFoto } from './foto';
import { registrarBaja, consultarBaja } from './baja';
import { enviarContacto } from './contacto';
import { registrarClub, resumenDiario } from './club';
import { listaAliados, fichaAliado, fotoAliado, crearReserva, panel, admin } from './aliados';
import { conectar, callback, sincronizar, feed, imagen, aprobar } from './instagram';

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
    if (url.pathname === '/api/club') {
      if (request.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { allow: 'POST' } });
      return registrarClub(request, env);
    }
    if (url.pathname === '/api/contacto') {
      if (request.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { allow: 'POST' } });
      return enviarContacto(request, env);
    }
    if (url.pathname === '/api/baja') {
      if (request.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { allow: 'POST' } });
      return registrarBaja(request, env);
    }
    if (url.pathname === '/api/baja/estado') return consultarBaja(request, env);
    if (url.pathname === '/api/foto') {
      if (request.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { allow: 'POST' } });
      return subirFoto(request, env);
    }
    if (url.pathname.startsWith('/ref/')) {
      const partes = url.pathname.slice(5).split('/');
      if (partes[1] === 'descargada' && request.method === 'POST') return borrarFoto(env, partes[0]);
      return verFoto(request, env, partes[0], url.searchParams.has('aliado'));
    }
    if (url.pathname.startsWith('/api/ig/')) {
      if (request.method !== 'GET') return new Response('Método no permitido', { status: 405, headers: { allow: 'GET' } });
      const r = url.pathname.slice(8);
      if (r === 'feed') return feed(env);
      if (r.startsWith('img/')) return imagen(env, r.slice(4));
      if (r === 'aprobar') return aprobar(request, env);
      if (r === 'conectar') return conectar(env);
      if (r === 'callback') return callback(request, env, ctx);
      return new Response('No encontrado', { status: 404 });
    }
    if (url.pathname === '/api/aliados') return listaAliados(env);
    if (url.pathname.startsWith('/api/aliados/')) {
      const [id, a, b] = url.pathname.slice(13).split('/');
      if (!a && request.method === 'GET') return fichaAliado(request, env, id);
      if (a === 'foto' && request.method === 'GET') return fotoAliado(env, id, b);
      if (a === 'reserva' && request.method === 'POST') return crearReserva(request, env, id);
      return new Response('No encontrado', { status: 404 });
    }
    if (url.pathname === '/api/panel' || url.pathname.startsWith('/api/panel/')) return panel(request, env, url.pathname.slice(11));
    if (url.pathname === '/api/admin/aliados') return admin(request, env);
    if (url.pathname === '/api/pais') {
      const c = (request as any).cf?.country ?? request.headers.get('cf-ipcountry') ?? '';
      const pais = c === 'VE' ? 'VE' : c === 'CL' ? 'CL' : 'OTRO';
      return new Response(JSON.stringify({ pais }), { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
    }
    if (url.pathname.startsWith('/api/')) return new Response('No encontrado', { status: 404 });
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event: any, env: any, ctx: any) {
    ctx.waitUntil(resumenDiario(env));
    ctx.waitUntil(sincronizar(env).catch((e: any) => console.log('ig sync', e?.message)));
  },
};
