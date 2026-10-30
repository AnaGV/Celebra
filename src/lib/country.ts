import type { CountryCode } from '../config/site';

/**
 * Detección inicial del país en el navegador, por zona horaria.
 * En producción conviene complementarlo con el país que Cloudflare
 * entrega en request.cf.country desde una Pages Function.
 * El comprador siempre puede cambiarlo en el checkout.
 */
export function detectCountry(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'America/Caracas') return 'VE';
    if (tz === 'America/Santiago' || tz === 'America/Punta_Arenas' || tz === 'Pacific/Easter') return 'CL';
  } catch {
    /* sin Intl: se usa el valor por defecto */
  }
  return 'OTRO';
}

/** Navegadores internos de apps, donde los popups de pago fallan con frecuencia. */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Line\//i.test(ua);
}
