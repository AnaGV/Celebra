/**
 * POST /api/contacto — formulario de la página Contacto.
 * Envía el mensaje por correo (Cloudflare Email Routing) a la casilla del negocio.
 * No guarda nada: el mensaje solo viaja al correo.
 */
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const limpio = (v: unknown, max: number) => String(v ?? '').replace(/[\r\0]/g, '').trim().slice(0, max);
const unaLinea = (v: string) => v.replace(/\n/g, ' ');

function b64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/.{1,76}/g, '$&\r\n');
}
const encabezado = (t: string) => `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(t)))}?=`;

export async function enviarContacto(request: Request, env: any): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origen no permitido' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 8000) return json({ error: 'El mensaje es muy largo' }, 413);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Trampas para robots: campo oculto y envío demasiado rápido.
  if (limpio(b.empresa, 100)) return json({ ok: true });
  if (Number(b.t || 0) && Date.now() - Number(b.t) < 2500) return json({ ok: true });

  const nombre = unaLinea(limpio(b.nombre, 80));
  const correo = unaLinea(limpio(b.correo, 120)).toLowerCase();
  const telefono = unaLinea(limpio(b.telefono, 40));
  const mensaje = limpio(b.mensaje, 3000);
  const origen = b.origen === 'empresas' ? 'empresas' : 'contacto';
  if (!nombre || !EMAIL.test(correo) || mensaje.length < 3) return json({ error: 'Revisa tu nombre, tu correo y tu mensaje.' }, 400);

  if (!env.CONTACTO) return json({ error: 'El correo aún no está configurado. Escríbenos por WhatsApp.' }, 503);

  const desde = 'contacto@somoscelebrave.com';
  const para = env.CONTACTO_DESTINO || 'somoscelebra.ve@gmail.com';
  const cuerpo = `Nuevo mensaje desde somoscelebrave.com/${origen}\n\nNombre: ${nombre}\nCorreo: ${correo}\nTeléfono: ${telefono || '-'}\n\nMensaje:\n${mensaje}\n\n— Responde a este correo para contestarle directamente.`;
  const id = `<${crypto.randomUUID()}@somoscelebrave.com>`;
  const raw = [
    `From: ${encabezado('Celebra · Contacto web')} <${desde}>`,
    `To: <${para}>`,
    `Reply-To: ${encabezado(nombre)} <${correo}>`,
    `Subject: ${encabezado(origen === 'empresas' ? `Cotización para empresa: ${nombre}` : `Nuevo mensaje de ${nombre}`)}`,
    `Message-ID: ${id}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(cuerpo),
  ].join('\r\n');

  try {
    const { EmailMessage } = await import('cloudflare:email');
    await env.CONTACTO.send(new EmailMessage(desde, para, raw));
    return json({ ok: true });
  } catch (e) {
    console.error('contacto', (e as Error).message);
    return json({ error: 'No pudimos enviarlo ahora. Escríbenos por WhatsApp.' }, 502);
  }
}
