/**
 * Correos a clientas (Resend) con una sola plantilla de marca.
 * Diseño: fondo gris muy claro, tarjeta blanca, logo arriba, botón rosa Celebra.
 * Hecho con tablas y estilos en línea para que se vea bien en Gmail, Outlook y el teléfono.
 * (Arial a propósito: es la letra que todos los programas de correo tienen.)
 */
const DOM = 'https://somoscelebrave.com';
export const esc = (t: string) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Plantilla = {
  /** Texto corto que se ve en la bandeja junto al asunto. */
  previa: string;
  imagen?: { src: string; alt: string };
  titulo: string;
  /** Párrafos (HTML ya escapado). */
  parrafos: string[];
  boton?: { texto: string; url: string };
  /** Bloque destacado (por ejemplo, el código de descuento). */
  destacado?: { etiqueta: string; valor: string; nota?: string; enlace?: { texto: string; url: string } };
  /** Letra chica al final de la tarjeta. */
  nota?: string;
  pie: string;
};

export function plantilla(p: Plantilla) {
  const f = 'font-family:Arial,Helvetica,sans-serif';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(p.titulo)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(p.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f5"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 18px"><a href="${DOM}"><img src="${DOM}/img/correo/logo.png" width="150" alt="Celebra" style="display:block;width:150px;height:auto;border:0"></a></td></tr>
<tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;border-top:6px solid #db3978">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${p.imagen ? `<tr><td align="center" style="padding:28px 28px 4px"><img src="${p.imagen.src}" width="200" alt="${esc(p.imagen.alt)}" style="display:block;width:200px;height:auto;border-radius:10px;border:1px solid #ececf1"></td></tr>` : ''}
<tr><td style="padding:24px 28px 8px;${f}">
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#16171a;${f}">${esc(p.titulo)}</h1>
${p.parrafos.map((t) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3d3d47">${t}</p>`).join('')}
</td></tr>
${p.boton ? `<tr><td align="center" style="padding:6px 28px 22px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:360px"><tr><td align="center" style="background:#db3978;border-radius:14px">
<a href="${p.boton.url}" style="display:block;padding:16px 22px;${f};font-size:17px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(p.boton.texto)}</a>
</td></tr></table></td></tr>` : ''}
${p.destacado ? `<tr><td style="padding:0 28px 22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f5;border:2px dashed #e98bb1;border-radius:16px"><tr><td align="center" style="padding:18px 16px;${f}">
<p style="margin:0 0 6px;font-size:14px;color:#3d3d47">${esc(p.destacado.etiqueta)}</p>
<p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:.1em;color:#16171a">${esc(p.destacado.valor)}</p>
${p.destacado.nota ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#6b6b78">${esc(p.destacado.nota)}</p>` : ''}
${p.destacado.enlace ? `<p style="margin:14px 0 0"><a href="${p.destacado.enlace.url}" style="font-size:15px;font-weight:bold;color:#db3978">${esc(p.destacado.enlace.texto)} →</a></p>` : ''}
</td></tr></table></td></tr>` : ''}
${p.nota ? `<tr><td style="padding:0 28px 26px;${f}"><p style="margin:0;font-size:14px;line-height:1.55;color:#6b6b78">${p.nota}</p></td></tr>` : ''}
</table></td></tr>
<tr><td align="center" style="padding:20px 10px 0;${f}">
<p style="margin:0 0 6px;font-size:13px;color:#6b6b78"><b style="color:#16171a">Celebra</b> · Taller de fiestas en Caripe, Venezuela</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#8b8b97">${p.pie} · <a href="${DOM}" style="color:#8b8b97">somoscelebrave.com</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export async function enviarCorreo(env: any, para: string, asunto: string, html: string, texto: string) {
  if (!env.RESEND_API_KEY) throw new Error('Falta RESEND_API_KEY');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'Celebra <contacto@somoscelebrave.com>', to: [para], reply_to: 'somoscelebra.ve@gmail.com', subject: asunto, html, text: texto }),
  });
  if (!r.ok) throw new Error('No se pudo enviar el correo (' + r.status + ')');
}
