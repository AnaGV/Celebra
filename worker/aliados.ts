/**
 * Aliados de Celebra: fichas con servicios, disponibilidad y reservas.
 *
 * Celebra NO cobra ni recibe pagos: el cliente le paga directo al aliado (Pago Móvil / Binance)
 * y el aliado verifica el pago en su panel. Celebra solo muestra la ficha y lleva el calendario.
 *
 * Datos en R2 (bucket FOTOS):
 *   aliados/<id>.json                ficha + servicios + días bloqueados + datos de pago (los carga el aliado)
 *   aliados-fotos/<id>/<1|2>         hasta 2 fotos
 *   reservas/<aliado>/<res>.json     solicitudes (apartada 24 h → confirmada / rechazada / vencida)
 *
 * Público:
 *   GET  /api/aliados                        lista (activos)
 *   GET  /api/aliados/<id>                   ficha + ocupación del mes (?mes=YYYY-MM)
 *   GET  /api/aliados/<id>/foto/<n>
 *   POST /api/aliados/<id>/reserva           crea la solicitud (aparta la fecha 24 h si el aliado usa calendario)
 * Panel del aliado (cabecera x-aliado: <token del enlace privado>):
 *   GET  /api/panel     PUT /api/panel     POST /api/panel/foto/<n>     POST /api/panel/reserva/<res>  {accion}
 * Admin (Ana, cabecera x-celebra-key):
 *   GET /api/admin/aliados   POST /api/admin/aliados  (crear/editar; devuelve el enlace privado)
 */

const DOM = 'https://somoscelebrave.com';
const APARTADO_MS = 24 * 3600 * 1000;
const MAX_FOTO = 1_500_000;

type Servicio = { id: string; nombre: string; precio: number; unidad: string; cantidad: number; activo: boolean };
type Aliado = {
  id: string; nombre: string; categorias: string[]; descripcion: string; zona: string;
  whatsapp: string; instagram: string; placeId: string;
  plan: 'gratis' | 'pro'; activo: boolean; calendario: boolean;
  servicios: Servicio[]; bloqueados: string[]; fotos: number[];
  pago: { pagoMovil?: { banco: string; telefono: string; cedula: string }; binance?: { id: string }; nota?: string };
  tokenHash: string; creado: string; confirmadoActivo?: string;
};
type Reserva = {
  id: string; aliado: string; fecha: string; items: { id: string; nombre: string; cant: number; precio: number }[];
  total: number; cliente: { nombre: string; whatsapp: string }; invitados: number; nota: string;
  metodo: string; referencia: string; captura: string;
  estado: 'apartada' | 'confirmada' | 'rechazada' | 'vencida'; creada: string; actualizada?: string;
};

const json = (d: unknown, s = 200, cache = 'no-store') => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': cache } });
const txt = (v: unknown, max: number) => String(v ?? '').replace(/[\r\0]/g, ' ').trim().slice(0, max);
const solo = (v: unknown, max: number) => txt(v, max).replace(/\n/g, ' ');
const ID = /^[a-z0-9-]{2,40}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function azar(n: number) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => abc[x % abc.length]).join('');
}
async function sha(s: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function igual(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const hoyVE = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);

async function leer<T>(env: any, k: string): Promise<T | null> {
  const o = await env.FOTOS.get(k); if (!o) return null;
  try { return (await o.json()) as T; } catch { return null; }
}
const guardar = (env: any, k: string, v: unknown) => env.FOTOS.put(k, JSON.stringify(v), { httpMetadata: { contentType: 'application/json' } });

function publico(a: Aliado) {
  return {
    id: a.id, nombre: a.nombre, categorias: a.categorias, descripcion: a.descripcion, zona: a.zona,
    instagram: a.instagram, placeId: a.placeId, plan: a.plan, calendario: a.calendario,
    whatsapp: a.whatsapp, fotos: a.fotos.map((n) => `/api/aliados/${a.id}/foto/${n}`),
    servicios: a.servicios.filter((s) => s.activo).map(({ id, nombre, precio, unidad, cantidad }) => ({ id, nombre, precio, unidad, cantidad })),
    pago: { pagoMovil: a.pago.pagoMovil || null, binance: a.pago.binance || null, nota: a.pago.nota || '' },
  };
}

async function reservasDe(env: any, aliado: string): Promise<Reserva[]> {
  const out: Reserva[] = []; let cursor: string | undefined;
  do {
    const l = await env.FOTOS.list({ prefix: `reservas/${aliado}/`, cursor });
    for (const o of l.objects) { const r = await leer<Reserva>(env, o.key); if (r) out.push(r); }
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  // Vencimiento perezoso: lo apartado hace más de 24 h sin respuesta se libera.
  for (const r of out) if (r.estado === 'apartada' && Date.now() - Date.parse(r.creada) > APARTADO_MS) {
    r.estado = 'vencida'; r.actualizada = new Date().toISOString(); await guardar(env, `reservas/${aliado}/${r.id}.json`, r);
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creada.localeCompare(b.creada));
}

/** Unidades usadas por servicio y por día (apartadas + confirmadas). */
function ocupacion(res: Reserva[]) {
  const m: Record<string, Record<string, number>> = {};
  for (const r of res) if (r.estado === 'apartada' || r.estado === 'confirmada')
    for (const it of r.items) { (m[r.fecha] ||= {}); m[r.fecha][it.id] = (m[r.fecha][it.id] || 0) + it.cant; }
  return m;
}

/* ---------------- Público ---------------- */

export async function listaAliados(env: any) {
  if (!env.FOTOS) return json({ aliados: [] });
  const out: any[] = []; let cursor: string | undefined;
  do {
    const l = await env.FOTOS.list({ prefix: 'aliados/', cursor });
    for (const o of l.objects) { const a = await leer<Aliado>(env, o.key); if (a?.activo) out.push(publico(a)); }
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  return json({ aliados: out }, 200, 'public, max-age=60');
}

export async function fichaAliado(request: Request, env: any, id: string) {
  const a = ID.test(id) ? await leer<Aliado>(env, `aliados/${id}.json`) : null;
  if (!a || !a.activo) return json({ error: 'No encontrado' }, 404);
  const mes = new URL(request.url).searchParams.get('mes') || hoyVE().slice(0, 7);
  const occ = a.calendario ? ocupacion(await reservasDe(env, a.id)) : {};
  const dias: Record<string, Record<string, number>> = {};
  for (const [f, v] of Object.entries(occ)) if (f.startsWith(mes)) dias[f] = v;
  return json({ aliado: publico(a), ocupado: dias, bloqueados: a.calendario ? a.bloqueados.filter((f) => f.startsWith(mes)) : [], hoy: hoyVE() });
}

export async function fotoAliado(env: any, id: string, n: string) {
  if (!ID.test(id) || !/^[12]$/.test(n)) return new Response('No encontrado', { status: 404 });
  const o = await env.FOTOS.get(`aliados-fotos/${id}/${n}`);
  if (!o) return new Response('No encontrado', { status: 404 });
  return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'public, max-age=300' } });
}

export async function crearReserva(request: Request, env: any, id: string) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origen no permitido' }, 403);
  const a = ID.test(id) ? await leer<Aliado>(env, `aliados/${id}.json`) : null;
  if (!a || !a.activo) return json({ error: 'No encontrado' }, 404);
  const b = (await request.json().catch(() => ({}))) as Record<string, any>;
  if (solo(b.empresa, 40)) return json({ ok: true });
  const fecha = solo(b.fecha, 10);
  if (!FECHA.test(fecha) || fecha < hoyVE()) return json({ error: 'Elige una fecha válida.' }, 400);
  const nombre = solo(b.nombre, 60), whatsapp = solo(b.whatsapp, 25).replace(/[^\d+ ]/g, '');
  if (!nombre || whatsapp.replace(/\D/g, '').length < 10) return json({ error: 'Escribe tu nombre y tu WhatsApp.' }, 400);
  const items: Reserva['items'] = [];
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 20) : []) {
    const s = a.servicios.find((x) => x.id === it?.id && x.activo); const cant = Math.max(1, Math.min(999, Math.round(Number(it?.cant) || 1)));
    if (s) items.push({ id: s.id, nombre: s.nombre, cant, precio: s.precio });
  }
  if (!items.length) return json({ error: 'Elige al menos un servicio.' }, 400);
  const captura = solo(b.captura, 120);
  if (captura) {
    let ok = false; try { const u = new URL(captura); ok = /^\/ref\/[A-Za-z0-9]{16}$/.test(u.pathname) && [new URL(request.url).host, 'somoscelebrave.com'].includes(u.host); } catch {}
    if (!ok) return json({ error: 'Captura no válida' }, 400);
  }

  if (a.calendario) {
    if (a.bloqueados.includes(fecha)) return json({ error: 'Ese día no está disponible.' }, 409);
    const occ = ocupacion(await reservasDe(env, a.id))[fecha] || {};
    for (const it of items) {
      const s = a.servicios.find((x) => x.id === it.id)!;
      if ((occ[it.id] || 0) + it.cant > s.cantidad) return json({ error: `${s.nombre}: no queda disponibilidad para esa fecha.` }, 409);
    }
  }
  const r: Reserva = {
    id: azar(10), aliado: a.id, fecha, items, total: Math.round(items.reduce((t, i) => t + i.cant * i.precio, 0) * 100) / 100,
    cliente: { nombre, whatsapp }, invitados: Math.max(0, Math.min(5000, Math.round(Number(b.invitados) || 0))), nota: solo(b.nota, 300),
    metodo: ['pagomovil', 'binance', 'despues'].includes(b.metodo) ? b.metodo : 'despues', referencia: solo(b.referencia, 40), captura,
    estado: 'apartada', creada: new Date().toISOString(),
  };
  await guardar(env, `reservas/${a.id}/${r.id}.json`, r);

  const fechaTxt = new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const lineas = [
    `Hola, ${a.nombre}. Te encontré en Celebra (somoscelebrave.com) y quiero reservar para el ${fechaTxt}:`,
    ...items.map((i) => `• ${i.nombre}${i.cant > 1 ? ' ×' + i.cant : ''}`),
    `Total: $${r.total}${r.invitados ? ` · ${r.invitados} invitados` : ''}`,
    r.metodo === 'pagomovil' ? `Pagué por Pago Móvil${r.referencia ? ' · Ref. ' + r.referencia : ''}` : r.metodo === 'binance' ? `Pagué por Binance${r.referencia ? ' · ' + r.referencia : ''}` : 'Quiero coordinar el pago.',
    ...(r.captura ? [`Captura del pago: ${r.captura}`] : []),
    ...(r.nota ? [`Nota: ${r.nota}`] : []),
    `Soy ${nombre}. Código de reserva: ${r.id}`,
  ];
  const wa = `https://wa.me/${a.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(lineas.join('\n'))}`;
  return json({ ok: true, id: r.id, wa, apartadaHasta: a.calendario ? new Date(Date.parse(r.creada) + APARTADO_MS).toISOString() : null });
}

/* ---------------- Panel del aliado ---------------- */

async function porToken(request: Request, env: any): Promise<Aliado | null> {
  const t = request.headers.get('x-aliado') || '';
  const m = /^([a-z0-9-]{2,40})\.([A-Za-z0-9]{24})$/.exec(t);
  if (!m) return null;
  const a = await leer<Aliado>(env, `aliados/${m[1]}.json`);
  return a && igual(a.tokenHash, await sha(m[2])) ? a : null;
}

export async function panel(request: Request, env: any, sub: string) {
  const a = await porToken(request, env);
  if (!a) return json({ error: 'Enlace no válido. Pídele uno nuevo a Celebra.' }, 401);
  const k = `aliados/${a.id}.json`;
  if (sub === '' && request.method === 'GET') {
    return json({ aliado: { ...publico(a), whatsapp: a.whatsapp, servicios: a.servicios, bloqueados: a.bloqueados, activo: a.activo }, reservas: await reservasDe(env, a.id), hoy: hoyVE() });
  }
  if (sub === '' && request.method === 'PUT') {
    const b = (await request.json().catch(() => ({}))) as Record<string, any>;
    if (b.descripcion !== undefined) a.descripcion = txt(b.descripcion, 400);
    if (b.zona !== undefined) a.zona = solo(b.zona, 60);
    if (b.instagram !== undefined) a.instagram = solo(b.instagram, 40).replace(/^@/, '');
    if (b.whatsapp !== undefined) { const w = solo(b.whatsapp, 20).replace(/\D/g, ''); if (w.length >= 10) a.whatsapp = w; }
    if (b.calendario !== undefined) a.calendario = !!b.calendario;
    if (Array.isArray(b.servicios)) a.servicios = b.servicios.slice(0, 15).map((s: any) => ({
      id: typeof s?.id === 'string' && ID.test(s.id) ? s.id : slug(solo(s?.nombre, 40)) || azar(6).toLowerCase(), nombre: solo(s?.nombre, 50),
      precio: Math.max(0, Math.round(Number(s?.precio) * 100) / 100 || 0), unidad: solo(s?.unidad, 20),
      cantidad: Math.max(1, Math.min(999, Math.round(Number(s?.cantidad) || 1))), activo: s?.activo !== false,
    })).filter((s: Servicio) => s.nombre);
    if (Array.isArray(b.bloqueados)) a.bloqueados = [...new Set(b.bloqueados.filter((f: any) => FECHA.test(f) && f >= hoyVE()))].sort().slice(0, 400) as string[];
    if (b.pago) {
      const pm = b.pago.pagoMovil, bi = b.pago.binance;
      a.pago = {
        pagoMovil: pm && solo(pm.telefono, 20) ? { banco: solo(pm.banco, 40), telefono: solo(pm.telefono, 20), cedula: solo(pm.cedula, 20) } : undefined,
        binance: bi && solo(bi.id, 60) ? { id: solo(bi.id, 60) } : undefined,
        nota: solo(b.pago.nota, 160),
      };
    }
    if (b.sigoActivo) a.confirmadoActivo = new Date().toISOString();
    await guardar(env, k, a);
    return json({ ok: true });
  }
  const mf = /^foto\/([12])$/.exec(sub);
  if (mf && request.method === 'POST') {
    const ct = (request.headers.get('content-type') || '').split(';')[0];
    if (ct !== 'image/jpeg') return json({ error: 'Formato no válido' }, 415);
    const len = Number(request.headers.get('content-length') || 0);
    if (!len || len > MAX_FOTO) return json({ error: 'Foto muy grande' }, 413);
    const buf = await request.arrayBuffer();
    const u = new Uint8Array(buf);
    if (buf.byteLength > MAX_FOTO || u[0] !== 0xff || u[1] !== 0xd8) return json({ error: 'Foto no válida' }, 400);
    await env.FOTOS.put(`aliados-fotos/${a.id}/${mf[1]}`, buf, { httpMetadata: { contentType: 'image/jpeg' } });
    a.fotos = [...new Set([...a.fotos, Number(mf[1])])].sort(); await guardar(env, k, a);
    return json({ ok: true });
  }
  const mr = /^reserva\/([A-Za-z0-9]{10})$/.exec(sub);
  if (mr && request.method === 'POST') {
    const rk = `reservas/${a.id}/${mr[1]}.json`; const r = await leer<Reserva>(env, rk);
    if (!r) return json({ error: 'No encontrada' }, 404);
    const b = (await request.json().catch(() => ({}))) as Record<string, any>;
    const map: Record<string, Reserva['estado']> = { confirmar: 'confirmada', rechazar: 'rechazada', reabrir: 'apartada' };
    if (!map[b.accion]) return json({ error: 'Acción no válida' }, 400);
    r.estado = map[b.accion]; r.actualizada = new Date().toISOString();
    if (b.accion === 'reabrir') r.creada = r.actualizada;
    await guardar(env, rk, r);
    const msg = r.estado === 'confirmada'
      ? `Hola ${r.cliente.nombre}, soy ${a.nombre}. ¡Tu reserva para el ${r.fecha} está confirmada! ✅ (Código ${r.id})`
      : r.estado === 'rechazada' ? `Hola ${r.cliente.nombre}, soy ${a.nombre}. No pude confirmar tu reserva del ${r.fecha} (código ${r.id}). ¿Lo revisamos?` : '';
    return json({ ok: true, avisar: msg ? `https://wa.me/${r.cliente.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` : null });
  }
  return json({ error: 'No encontrado' }, 404);
}

/* ---------------- Admin (Ana) ---------------- */

export async function admin(request: Request, env: any) {
  const key = request.headers.get('x-celebra-key') || '';
  const clave = String(env.CELEBRA_ADMIN_KEY || '');
  if (clave.length < 10) return json({ error: 'Falta configurar CELEBRA_ADMIN_KEY en Cloudflare' }, 503);
  if (!igual(key, clave)) return json({ error: 'Clave incorrecta' }, 401);
  if (request.method === 'GET') {
    const out: any[] = []; let cursor: string | undefined;
    do {
      const l = await env.FOTOS.list({ prefix: 'aliados/', cursor });
      for (const o of l.objects) { const a = await leer<Aliado>(env, o.key); if (a) out.push({ id: a.id, nombre: a.nombre, categorias: a.categorias, whatsapp: a.whatsapp, descripcion: a.descripcion, zona: a.zona, plan: a.plan, activo: a.activo, confirmadoActivo: a.confirmadoActivo || null }); }
      cursor = l.truncated ? l.cursor : undefined;
    } while (cursor);
    return json({ aliados: out });
  }
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  const b = (await request.json().catch(() => ({}))) as Record<string, any>;
  const nombre = solo(b.nombre, 60); if (!nombre) return json({ error: 'Falta el nombre' }, 400);
  const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : slug(nombre);
  const k = `aliados/${id}.json`;
  const previo = await leer<Aliado>(env, k);
  const nuevoEnlace = !previo || b.nuevoEnlace === true;
  const token = azar(24);
  const a: Aliado = previo || {
    id, nombre, categorias: [], descripcion: '', zona: 'Caripe', whatsapp: '', instagram: '', placeId: '',
    plan: 'gratis', activo: true, calendario: true, servicios: [], bloqueados: [], fotos: [], pago: {}, tokenHash: '', creado: new Date().toISOString(),
  };
  a.nombre = nombre;
  if (Array.isArray(b.categorias)) a.categorias = b.categorias.map((c: any) => solo(c, 20)).slice(0, 4);
  if (b.whatsapp !== undefined) a.whatsapp = solo(b.whatsapp, 20).replace(/\D/g, '');
  if (b.descripcion !== undefined) a.descripcion = txt(b.descripcion, 400);
  if (b.zona !== undefined) a.zona = solo(b.zona, 60);
  if (b.placeId !== undefined) a.placeId = solo(b.placeId, 80);
  if (b.plan === 'pro' || b.plan === 'gratis') a.plan = b.plan;
  if (b.activo !== undefined) a.activo = !!b.activo;
  if (nuevoEnlace) a.tokenHash = await sha(token);
  await guardar(env, k, a);
  return json({ ok: true, id, enlace: nuevoEnlace ? `${DOM}/aliado/#${id}.${token}` : null });
}
