/**
 * Instagram de Celebra en la página de inicio.
 *
 * Conexión (una sola vez, la hace la dueña):
 *   GET /api/ig/conectar  → abre el inicio de sesión unificado de Meta (Facebook Login for Business, config_id).
 *   GET /api/ig/callback  → Meta vuelve con un código; se cambia por el token de usuario del sistema (no vence)
 *                           y se guarda en R2 (privado/ig.json). El token nunca se muestra a nadie.
 *   Solo se acepta la cuenta @somoscelebra.ve (o IG_USERNAME), así nadie más puede "conectar" la suya.
 *
 * Cada día (cron) y justo después de conectar:
 *   - Trae las últimas 12 publicaciones y sus comentarios.
 *   - Guarda una copia de cada imagen en R2 (los enlaces de Instagram caducan).
 *   - Manda un correo a la dueña con los comentarios nuevos y dos enlaces: "Mostrar en la web" / "Ocultar".
 *
 * Público:
 *   GET /api/ig/feed       → publicaciones + SOLO los comentarios aprobados.
 *   GET /api/ig/img/<id>   → la imagen guardada.
 *   GET /api/ig/aprobar?c=<id>&a=1|0&s=<firma>  → enlace del correo (firmado, no se puede adivinar).
 *
 * Secretos en Cloudflare: IG_APP_ID, IG_APP_SECRET, IG_CONFIG_ID. Opcional: IG_USERNAME.
 */

const G = 'https://graph.facebook.com';
const DOM = 'https://somoscelebrave.com';
const REDIRECT = `${DOM}/api/ig/callback`;
const K_TOKEN = 'privado/ig.json';
const K_FEED = 'ig/feed.json';
const K_APROB = 'ig/aprobados.json';
const K_VISTOS = 'ig/vistos.json';

type Cuenta = { token: string; igId: string; username: string; conectado: string };
type Comentario = { id: string; usuario: string; texto: string; fecha: string };
type Post = {
  id: string; tipo: string; texto: string; enlace: string; fecha: string;
  likes: number | null; nComentarios: number; img: string | null; comentarios: Comentario[];
};

const json = (d: unknown, s = 200, cache = 'no-store') =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': cache } });
const html = (titulo: string, cuerpo: string, s = 200) => new Response(
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px;color:#16171a;line-height:1.5"><h1 style="font-size:22px">${titulo}</h1>${cuerpo}<p><a href="/" style="color:#6043e1">Ir a la página</a></p></body></html>`,
  { status: s, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });

async function leer<T>(env: any, k: string, def: T): Promise<T> {
  const o = await env.FOTOS.get(k);
  if (!o) return def;
  try { return (await o.json()) as T; } catch { return def; }
}
const guardar = (env: any, k: string, v: unknown) =>
  env.FOTOS.put(k, JSON.stringify(v), { httpMetadata: { contentType: 'application/json' } });

async function firma(env: any, texto: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('ig-aprobar:' + env.IG_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(texto)));
  return [...s.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function igual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function api(path: string, token: string) {
  const u = new URL(G + path);
  u.searchParams.set('access_token', token);
  const r = await fetch(u.toString());
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d?.error?.message || `Error ${r.status}`);
  return d;
}

/* ---------- Conexión ---------- */

export function conectar(env: any): Response {
  if (!env.IG_APP_ID || !env.IG_CONFIG_ID || !env.IG_APP_SECRET) return html('Falta configurar', '<p>Faltan IG_APP_ID, IG_APP_SECRET o IG_CONFIG_ID en Cloudflare.</p>', 503);
  const state = crypto.randomUUID();
  const u = new URL('https://www.facebook.com/dialog/oauth');
  u.searchParams.set('client_id', env.IG_APP_ID);
  u.searchParams.set('redirect_uri', REDIRECT);
  u.searchParams.set('config_id', env.IG_CONFIG_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('override_default_response_type', 'true');
  u.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: { location: u.toString(), 'set-cookie': `ig_state=${state}; Path=/api/ig; Max-Age=900; HttpOnly; Secure; SameSite=Lax`, 'cache-control': 'no-store' },
  });
}

async function buscarCuenta(token: string): Promise<{ id: string; username: string }[]> {
  // El token de usuario del sistema puede ver la cuenta por varios caminos según cómo Meta la asignó.
  const ids = new Set<string>();
  const notas: string[] = [];
  const probar = async (path: string, sacar: (d: any) => (string | undefined)[]) => {
    try { for (const id of sacar(await api(path, token))) if (id) ids.add(String(id)); }
    catch (e: any) { notas.push(`${path.split('?')[0]}: ${e?.message}`); }
  };
  await probar('/me/assigned_instagram_accounts?fields=id', (d) => (d.data || []).map((x: any) => x?.id));
  await probar('/me/instagram_accounts?fields=id', (d) => (d.data || []).map((x: any) => x?.id));
  await probar('/me/accounts?fields=instagram_business_account', (d) => (d.data || []).map((x: any) => x?.instagram_business_account?.id));
  if (!ids.size) {
    try {
      const bs = await api('/me/businesses?fields=id', token);
      for (const b of bs.data || []) {
        await probar(`/${b.id}/owned_instagram_accounts?fields=id`, (d) => (d.data || []).map((x: any) => x?.id));
        await probar(`/${b.id}/instagram_business_accounts?fields=id`, (d) => (d.data || []).map((x: any) => x?.id));
        await probar(`/${b.id}/instagram_accounts?fields=id`, (d) => (d.data || []).map((x: any) => x?.id));
      }
    } catch (e: any) { notas.push('/me/businesses: ' + e?.message); }
  }
  const out: { id: string; username: string }[] = [];
  for (const id of ids) {
    try { const d = await api(`/${id}?fields=id,username`, token); out.push({ id: d.id || id, username: d.username || '' }); }
    catch (e: any) { notas.push(`/${id}: ${e?.message}`); out.push({ id, username: '' }); }
  }
  console.log('ig cuentas', JSON.stringify({ encontradas: out, notas }));
  return out;
}

export async function callback(request: Request, env: any, ctx: any): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const cookie = /(?:^|;\s*)ig_state=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1] || '';
  if (!state || !cookie || !igual(state, cookie)) return html('Enlace vencido', '<p>Vuelve a abrir <a href="/api/ig/conectar">/api/ig/conectar</a> e inténtalo otra vez.</p>', 400);
  if (url.searchParams.get('error')) return html('Conexión cancelada', '<p>No se conectó Instagram. Puedes intentarlo de nuevo cuando quieras.</p>', 400);
  const code = url.searchParams.get('code');
  if (!code) return html('Falta el código', '<p>Meta no envió el código de acceso.</p>', 400);

  const t = new URL(G + '/oauth/access_token');
  t.searchParams.set('client_id', env.IG_APP_ID);
  t.searchParams.set('client_secret', env.IG_APP_SECRET);
  t.searchParams.set('redirect_uri', REDIRECT);
  t.searchParams.set('code', code);
  const r = await fetch(t.toString());
  const d: any = await r.json().catch(() => ({}));
  if (!d.access_token) return html('No se pudo conectar', `<p>Meta respondió: ${String(d?.error?.message || r.status).replace(/[<>&]/g, '')}</p>`, 400);

  const esperado = String(env.IG_USERNAME || 'somoscelebra.ve').toLowerCase();
  const cuentas = await buscarCuenta(d.access_token);
  const c = cuentas.find((x) => x.username.toLowerCase() === esperado) || (cuentas.length === 1 && !cuentas[0].username ? cuentas[0] : null);
  if (!c) {
    const vistas = cuentas.map((x) => '@' + x.username).join(', ') || 'ninguna';
    return html('Cuenta no permitida', `<p>Solo se puede conectar @${esperado}. Meta devolvió: ${vistas.replace(/[<>&]/g, '')}.</p>`, 403);
  }
  const cuenta: Cuenta = { token: d.access_token, igId: c.id, username: c.username || esperado, conectado: new Date().toISOString() };
  await guardar(env, K_TOKEN, cuenta);
  ctx.waitUntil(sincronizar(env, true).catch((e) => console.log('ig sync', e?.message)));
  return new Response(html('Instagram conectado ✓', `<p>@${cuenta.username} quedó conectado. En unos minutos aparecen tus publicaciones en la página y te llega un correo con los comentarios para aprobar.</p>`).body, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': 'ig_state=; Path=/api/ig; Max-Age=0; HttpOnly; Secure; SameSite=Lax' },
  });
}

/* ---------- Sincronización diaria ---------- */

async function guardarImagen(env: any, id: string, src: string | undefined) {
  if (!src) return false;
  const k = `ig/img/${id}`;
  if (await env.FOTOS.head(k)) return true;
  const r = await fetch(src);
  if (!r.ok) return false;
  const tipo = r.headers.get('content-type') || 'image/jpeg';
  if (!tipo.startsWith('image/')) return false;
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 8_000_000) return false;
  await env.FOTOS.put(k, buf, { httpMetadata: { contentType: tipo } });
  return true;
}

export async function sincronizar(env: any, avisarTodo = false) {
  if (!env.FOTOS) return;
  const cuenta = await leer<Cuenta | null>(env, K_TOKEN, null);
  if (!cuenta) return;
  const campos = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_type,media_url,thumbnail_url}';
  const d = await api(`/${cuenta.igId}/media?fields=${encodeURIComponent(campos)}&limit=12`, cuenta.token);
  const vistos = new Set(await leer<string[]>(env, K_VISTOS, []));
  const nuevos: { post: Post; c: Comentario }[] = [];
  const posts: Post[] = [];

  for (const m of d.data || []) {
    let src: string | undefined = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
    if (m.media_type === 'CAROUSEL_ALBUM') {
      const h = m.children?.data?.[0];
      src = h ? (h.media_type === 'VIDEO' ? h.thumbnail_url : h.media_url) : src;
    }
    const ok = await guardarImagen(env, m.id, src).catch(() => false);
    const post: Post = {
      id: m.id, tipo: m.media_type, texto: String(m.caption || '').slice(0, 600), enlace: m.permalink,
      fecha: m.timestamp, likes: typeof m.like_count === 'number' ? m.like_count : null,
      nComentarios: m.comments_count || 0, img: ok ? `/api/ig/img/${m.id}` : null, comentarios: [],
    };
    if (post.nComentarios > 0) {
      try {
        const cs = await api(`/${m.id}/comments?fields=id,text,username,timestamp&limit=25`, cuenta.token);
        for (const x of cs.data || []) {
          if (!x?.id || !x.text) continue;
          const c: Comentario = { id: x.id, usuario: String(x.username || ''), texto: String(x.text).slice(0, 280), fecha: x.timestamp };
          post.comentarios.push(c);
          if (!vistos.has(c.id) && c.usuario.toLowerCase() !== cuenta.username.toLowerCase()) nuevos.push({ post, c });
          vistos.add(c.id);
        }
      } catch { /* sin comentarios esta vez */ }
    }
    posts.push(post);
  }
  await guardar(env, K_FEED, { actualizado: new Date().toISOString(), posts });
  await guardar(env, K_VISTOS, [...vistos].slice(-2000));

  // Imágenes de publicaciones que ya no están entre las 12 últimas: se borran.
  const actuales = new Set(posts.map((p) => `ig/img/${p.id}`));
  const lista = await env.FOTOS.list({ prefix: 'ig/img/' });
  for (const o of lista.objects) if (!actuales.has(o.key)) await env.FOTOS.delete(o.key);

  if (nuevos.length) await avisarComentarios(env, nuevos, avisarTodo);
}

function b64(s: string) { let o = ''; for (const b of new TextEncoder().encode(s)) o += String.fromCharCode(b); return btoa(o).replace(/.{1,76}/g, '$&\r\n'); }
const enc = (t: string) => { let o = ''; for (const b of new TextEncoder().encode(t)) o += String.fromCharCode(b); return `=?UTF-8?B?${btoa(o)}?=`; };

async function avisarComentarios(env: any, nuevos: { post: Post; c: Comentario }[], primeraVez: boolean) {
  if (!env.CONTACTO) return;
  const lineas: string[] = [
    primeraVez ? 'Instagram quedó conectado. Estos son los comentarios de tus últimas publicaciones.' : 'Hay comentarios nuevos en tu Instagram.',
    'Ninguno aparece en la página hasta que toques "Mostrar en la web".', '',
  ];
  for (const { post, c } of nuevos.slice(0, 40)) {
    const s1 = await firma(env, `${c.id}:1`);
    const s0 = await firma(env, `${c.id}:0`);
    lineas.push(
      `Publicación: ${post.texto.split('\n')[0].slice(0, 70) || post.enlace}`,
      `@${c.usuario}: "${c.texto}"`,
      `  Mostrar en la web: ${DOM}/api/ig/aprobar?c=${c.id}&a=1&s=${s1}`,
      `  Ocultar:           ${DOM}/api/ig/aprobar?c=${c.id}&a=0&s=${s0}`, '',
    );
  }
  if (nuevos.length > 40) lineas.push(`…y ${nuevos.length - 40} más.`);
  const desde = 'contacto@somoscelebrave.com';
  const para = env.CONTACTO_DESTINO || 'somoscelebra.ve@gmail.com';
  const raw = [
    `From: ${enc('Celebra · Instagram')} <${desde}>`, `To: <${para}>`,
    `Subject: ${enc(`${nuevos.length} comentario${nuevos.length === 1 ? '' : 's'} para revisar`)}`,
    `Message-ID: <${crypto.randomUUID()}@somoscelebrave.com>`, `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(lineas.join('\n')),
  ].join('\r\n');
  const { EmailMessage } = await import('cloudflare:email');
  await env.CONTACTO.send(new EmailMessage(desde, para, raw));
}

/* ---------- Público ---------- */

export async function aprobar(request: Request, env: any): Promise<Response> {
  const u = new URL(request.url);
  const id = (u.searchParams.get('c') || '').replace(/[^\d_]/g, '').slice(0, 40);
  const a = u.searchParams.get('a') === '1' ? '1' : '0';
  const s = u.searchParams.get('s') || '';
  if (!id || !env.IG_APP_SECRET || !igual(s, await firma(env, `${id}:${a}`))) return html('Enlace no válido', '<p>Este enlace no es correcto.</p>', 403);
  const set = new Set(await leer<string[]>(env, K_APROB, []));
  if (a === '1') set.add(id); else set.delete(id);
  await guardar(env, K_APROB, [...set].slice(-500));
  return a === '1'
    ? html('Comentario publicado ✓', '<p>Ya se ve en la página de inicio (puede tardar unos minutos).</p>')
    : html('Comentario oculto', '<p>Este comentario no se muestra en la página.</p>');
}

export async function feed(env: any): Promise<Response> {
  if (!env.FOTOS) return json({ posts: [] }, 200, 'public, max-age=300');
  const f = await leer<{ posts: Post[] } | null>(env, K_FEED, null);
  if (!f) return json({ posts: [] }, 200, 'public, max-age=300');
  const ok = new Set(await leer<string[]>(env, K_APROB, []));
  const posts = f.posts.filter((p) => p.img).map((p) => ({
    id: p.id, tipo: p.tipo, texto: p.texto, enlace: p.enlace, fecha: p.fecha, likes: p.likes,
    nComentarios: p.nComentarios, img: p.img,
    comentarios: p.comentarios.filter((c) => ok.has(c.id)).slice(0, 3).map((c) => ({ usuario: c.usuario, texto: c.texto })),
  }));
  return json({ posts }, 200, 'public, max-age=600');
}

export async function imagen(env: any, id: string): Promise<Response> {
  const limpio = id.replace(/[^\d_]/g, '').slice(0, 40);
  const o = limpio && (await env.FOTOS.get(`ig/img/${limpio}`));
  if (!o) return new Response('No encontrado', { status: 404 });
  return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
}
