import type { CountryCode } from '../config/site';
import { detectCountry } from './country';

/**
 * País del visitante. Primero una estimación por zona horaria (instantánea),
 * luego el país real que entrega Cloudflare (/api/pais). Marca <html data-pais="VE|CL|OTRO">
 * y avisa con el evento "celebra:pais" para que la página y el checkout se ajusten.
 */
export function setPais(p: CountryCode) {
  document.documentElement.dataset.pais = p;
  window.dispatchEvent(new CustomEvent('celebra:pais', { detail: p }));
}

export async function initPais(): Promise<CountryCode> {
  const manual = (() => { try { return sessionStorage.getItem('celebra-pais') as CountryCode | null; } catch { return null; } })();
  if (manual) { setPais(manual); return manual; }
  setPais(detectCountry());
  try {
    const res = await fetch('/api/pais', { headers: { accept: 'application/json' } });
    if (res.ok) {
      const { pais } = await res.json();
      if (pais === 'VE' || pais === 'CL' || pais === 'OTRO') { setPais(pais); return pais; }
    }
  } catch { /* sin conexión al worker: queda la estimación */ }
  return (document.documentElement.dataset.pais as CountryCode) || 'OTRO';
}

export function elegirPais(p: CountryCode) {
  try { sessionStorage.setItem('celebra-pais', p); } catch { /* sin almacenamiento: solo esta vista */ }
  setPais(p);
}
