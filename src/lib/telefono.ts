/** Códigos de país para WhatsApp. Venezuela y Chile primero (familia Celebra), luego la diáspora más común. */
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

/** Une código + número local: quita espacios, el 0 inicial (0414 → 414) y un código repetido. */
export function unirTel(cc: string, local: string): string {
  let n = String(local || '').replace(/\D/g, '');
  if (n.startsWith(cc) && n.length > cc.length + 8) n = n.slice(cc.length);
  n = n.replace(/^0+/, '');
  return n ? cc + n : '';
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
    const sync = () => { out.value = unirTel(sel.value, num.value); };
    sel.addEventListener('change', sync); num.addEventListener('input', sync);
    (w as any).poner = (full: string) => { const s = separarTel(full); sel.value = s.cc; num.value = s.local; sync(); };
    (w as any).limpiar = () => { num.value = ''; sync(); };
  });
}

export function ponerTel(w: Element | null, full: string) { (w as any)?.poner?.(full); }
