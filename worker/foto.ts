/**
 * Fotos de referencia que se autodestruyen.
 *
 * POST /api/foto   → guarda una foto (JPEG, ya achicada en el navegador) en R2
 *                    y devuelve el link https://somoscelebrave.com/ref/<id>.
 * GET  /ref/<id>   → muestra la foto con un botón "Descargar". Al descargarla se borra.
 *                    Los "robots" de vista previa (WhatsApp, Facebook…) no ven la foto.
 * POST /ref/<id>/descargada → la borra (lo llama el botón después de descargar).
 *
 * Si nadie la descarga, se borra a las 24 horas de subida (se revisa aquí; la regla
 * de ciclo de vida del bucket la elimina del todo a las 72 h).
 */

const MAX_BYTES = 1_500_000; // la foto ya llega achicada (~200-500 KB); 1,5 MB es el techo
const MAX_EDAD_MS = 24 * 60 * 60 * 1000;
const BOTS = /whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|bot\b|crawler|spider|preview/i;

const ID_RE = /^[A-Za-z0-9]{16}$/;

function nuevoId(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => abc[x % abc.length]).join('');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export async function subirFoto(request: Request, env: any): Promise<Response> {
  if (!env.FOTOS) return json({ error: 'Fotos no configuradas' }, 503);
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return json({ error: 'Origen no permitido' }, 403);

  if ((request.headers.get('content-type') || '').split(';')[0].trim() !== 'image/jpeg') return json({ error: 'Formato no válido' }, 415);
  // Se exige el tamaño por adelantado y se corta antes de leer si es grande.
  const cl = request.headers.get('content-length');
  if (!cl) return json({ error: 'Falta el tamaño' }, 411);
  const largo = Number(cl);
  if (!Number.isFinite(largo) || largo <= 0 || largo > MAX_BYTES) return json({ error: 'La foto es muy grande' }, 413);
  // Lectura con tope: aunque mientan en el tamaño, nunca se guardan más de MAX_BYTES en memoria.
  const reader = request.body!.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); return json({ error: 'La foto es muy grande' }, 413); }
    partes.push(value);
  }
  if (total === 0) return json({ error: 'Foto vacía' }, 400);
  const u8 = new Uint8Array(total);
  let off = 0;
  for (const p of partes) { u8.set(p, off); off += p.byteLength; }
  const datos = u8.buffer;
  const b = new Uint8Array(datos, 0, 3);
  if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) return json({ error: 'Formato no válido' }, 415);

  const id = nuevoId();
  await env.FOTOS.put(`ref/${id}`, datos, {
    httpMetadata: { contentType: 'image/jpeg' },
    customMetadata: { subida: String(Date.now()) },
  });
  return json({ url: `${url.origin}/ref/${id}` });
}

function pagina(titulo: string, cuerpo: string, status = 200): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${titulo}</title>
<meta property="og:title" content="Foto de referencia · Celebra"><meta property="og:description" content="Ábrela para verla. Se borra al abrirla."><meta property="og:image" content="https://somoscelebrave.com/img/og-celebra.jpg">
<link rel="icon" href="/favicon.ico"><style>body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f7f3ff;color:#16171a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}main{max-width:560px;width:100%;background:#fff;border-radius:20px;padding:22px;box-shadow:0 18px 40px -28px rgba(43,29,92,.5);text-align:center}h1{font-size:22px;margin:0 0 8px;color:#2b1d5c}p{margin:0 0 14px;color:#5c6070;line-height:1.5}img{max-width:100%;border-radius:12px;display:block;margin:0 auto 16px}a.b{display:inline-flex;min-height:50px;align-items:center;padding:0 22px;border-radius:12px;background:#6043e1;color:#fff;font-weight:700;text-decoration:none}.aviso{background:#fbe6ee;color:#8a1f48;border-radius:12px;padding:12px 14px;font-size:15px;margin-bottom:16px}</style></head><body><main>${cuerpo}</main></body></html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, private', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' },
  });
}

function aBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Se llama solo después de descargar la foto: la borra del servidor. */
export async function borrarFoto(env: any, id: string): Promise<Response> {
  if (env.FOTOS && ID_RE.test(id)) await env.FOTOS.delete(`ref/${id}`);
  return json({ ok: true });
}

export async function verFoto(request: Request, env: any, id: string, aliado = false): Promise<Response> {
  const ua = request.headers.get('user-agent') || '';
  if (request.method === 'HEAD' || BOTS.test(ua)) {
    return pagina('Foto de referencia · Celebra', '<h1>Foto de referencia</h1><p>Ábrela para verla.</p>');
  }
  const panel = aliado ? '<a class="b" href="/aliado/" style="background:#16171a;margin-top:12px">Ir a mi panel para confirmar la reserva</a>' : '';
  const noEsta = () => pagina('Foto no disponible', `<h1>Esta foto ya no está</h1><p>Las fotos se borran al descargarlas, o a las 24 horas si nadie las descarga. Pídele a la persona que te la envíe de nuevo por WhatsApp.</p>${panel}`, 404);
  if (!env.FOTOS || !ID_RE.test(id)) return noEsta();

  const key = `ref/${id}`;
  const obj = await env.FOTOS.get(key);
  if (!obj) return noEsta();
  const subida = Number(obj.customMetadata?.subida || 0);
  const ahora = Date.now();
  if (subida && ahora - subida > MAX_EDAD_MS) { await env.FOTOS.delete(key); return noEsta(); }
  const datos = await obj.arrayBuffer();
  const horas = Math.max(1, Math.ceil(((subida || ahora) + MAX_EDAD_MS - ahora) / 3600e3));
  const src = `data:image/jpeg;base64,${aBase64(datos)}`;
  return pagina(
    'Foto · Celebra',
    `<h1>Descarga esta foto</h1>
<div class="aviso">Se borra en cuanto la descargas. <b>Si no la descargas en ${horas} hora${horas === 1 ? '' : 's'}, se elimina sola.</b></div>
<img id="foto" src="${src}" alt="Foto enviada por WhatsApp">
<a class="b" id="guardar" href="${src}" download="foto-${id}.jpg">Descargar foto</a>
<p id="listo" style="display:none;margin-top:14px;font-weight:700;color:#17603b">✓ Descargada. Ya está en tu teléfono y se borró de la página.</p>
${panel ? `<p style="margin:16px 0 0">${panel}</p>` : ''}
<script>
(function(){var b=document.getElementById('guardar'),f=null,hecho=false;
function borrar(){if(hecho)return;hecho=true;setTimeout(function(){fetch('/ref/${id}/descargada',{method:'POST',keepalive:true});document.getElementById('listo').style.display='block';b.style.display='none';},1500);}
if(navigator.canShare&&window.File){fetch(b.href).then(function(r){return r.blob()}).then(function(bl){var x=new File([bl],'foto-${id}.jpg',{type:'image/jpeg'});if(navigator.canShare({files:[x]}))f=x;});}
b.addEventListener('click',function(e){if(f){e.preventDefault();navigator.share({files:[f]}).then(borrar).catch(function(){});}else{borrar();}});})();
</script>`,
  );
}
