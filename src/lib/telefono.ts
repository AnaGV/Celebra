/** Códigos de país para WhatsApp. Venezuela y Chile primero (familia Celebra), luego la diáspora más común. */
export const EJEMPLO: Record<string, string> = { '58': '414 123 4567', '56': '9 1234 5678', '57': '300 123 4567', '51': '912 345 678', '593': '99 123 4567', '54': '9 11 1234 5678', '507': '6123 4567', '52': '55 1234 5678', '34': '612 345 678', '1': '305 123 4567' };

export const CODIGOS = [
  { cc: '58', pais: 'Venezuela', bandera: '🇻🇪' },
  { cc: '56', pais: 'Chile', bandera: '🇨🇱' },
  { cc: '57', pais: 'Colombia', bandera: '🇨🇴' },
  { cc: '51', pais: 'Perú', bandera: '🇵🇪' },
  { cc: '593', pais: 'Ecuador', bandera: '🇪🇨' },
  { cc: '54', pais: 'Argentina', bandera: '🇦🇷' },
  { cc: '507', pais: 'Panamá', bandera: '🇵🇦' },
  { cc: '52', pais: 'México', bandera: '🇲🇽' },
  { cc: '34', pais: 'España', bandera: '🇪🇸' },
  { cc: '1', pais: 'EE. UU.', bandera: '🇺🇸' },
];

const VE_MOVIL = /^0?4(1[246]|2[46])\d{7}$/; // 0412, 0414, 0416, 0424, 0426

/**
 * Une código + número. Corrige los errores comunes:
 * - un celular venezolano (0414…) siempre va con +58, aunque el selector diga otro país;
 * - si escriben el número con su código (+56 9…, 58414…), se respeta;
 * - quita el 0 inicial y los espacios.
 */
export function unirTel(cc: string, local: string): string {
  const raw = String(local || '').trim();
  let n = raw.replace(/\D/g, '');
  if (!n) return '';
  if (VE_MOVIL.test(n)) return '58' + n.replace(/^0/, '');
  if (raw.startsWith('+') || raw.startsWith('00')) return n.replace(/^00/, '');
  const otro = CODIGOS.find((k) => n.startsWith(k.cc) && n.length >= k.cc.length + 9);
  if (otro) return n;
  n = n.replace(/^0+/, '');
  return cc + n;
}

/** ¿Parece un WhatsApp válido? (revisa Venezuela y Chile; el resto, largo razonable) */
export function telValido(full: string) {
  if (full.startsWith('58')) return /^584\d{9}$/.test(full);
  if (full.startsWith('56')) return /^569\d{8}$/.test(full);
  return full.length >= 10 && full.length <= 15;
}

export function telBonito(full: string) {
  const c = [...CODIGOS].sort((a, b) => b.cc.length - a.cc.length).find((k) => full.startsWith(k.cc));
  if (!c) return '+' + full;
  const r = full.slice(c.cc.length);
  const f = c.cc === '56' && r.length === 9 ? r.replace(/(\d)(\d{4})(\d{4})/, '$1 $2 $3') : r.replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3');
  return `${c.bandera} +${c.cc} ${f}`;
}

/** Separa un número completo en código + resto (para editar). */
export function separarTel(full: string): { cc: string; local: string } {
  const d = String(full || '').replace(/\D/g, '');
  const c = [...CODIGOS].sort((a, b) => b.cc.length - a.cc.length).find((k) => d.startsWith(k.cc));
  return c ? { cc: c.cc, local: d.slice(c.cc.length) } : { cc: '58', local: d };
}

/**
 * Conecta cada bloque [data-tel]: <select data-tel-cc> + <input data-tel-num> → <input type=hidden name=...>.
 * Llamar después de pintar; volver a llamar es seguro.
 */
export function montarTel(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-tel]').forEach((w) => {
    if (w.dataset.listo) return; w.dataset.listo = '1';
    const sel = w.querySelector<HTMLSelectElement>('[data-tel-cc]')!, num = w.querySelector<HTMLInputElement>('[data-tel-num]')!, out = w.querySelector<HTMLInputElement>('input[type=hidden]')!;
    const ver = w.querySelector<HTMLElement>('[data-tel-ver]');
    const sync = () => {
      out.value = unirTel(sel.value, num.value);
      const c = CODIGOS.find((k) => out.value.startsWith(k.cc) && k.cc !== sel.value && out.value.length >= k.cc.length + 9 && !out.value.startsWith(sel.value));
      if (c) { sel.value = c.cc; num.placeholder = 'Ej. ' + (EJEMPLO[c.cc] || ''); }
      if (ver) {
        const ok = !out.value || telValido(out.value);
        ver.hidden = !out.value; ver.classList.toggle('mal', !ok);
        ver.textContent = ok ? `WhatsApp: ${telBonito(out.value)}` : `Revisa el número: ${telBonito(out.value)} no parece un WhatsApp válido`;
      }
    };
    const ph = () => { num.placeholder = 'Ej. ' + (EJEMPLO[sel.value] || ''); };
    ph(); sel.addEventListener('change', () => { ph(); sync(); }); num.addEventListener('input', sync);
    (w as any).poner = (full: string) => { const s = separarTel(full); sel.value = s.cc; num.value = s.local; sync(); };
    (w as any).limpiar = () => { num.value = ''; sync(); };
  });
}

export function ponerTel(w: Element | null, full: string) { (w as any)?.poner?.(full); }
