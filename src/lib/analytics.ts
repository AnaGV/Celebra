/**
 * Eventos para Meta Ads. En el navegador usamos el Pixel (fbq) si está cargado.
 * El evento Purchase definitivo debe enviarse desde el servidor (Conversions API)
 * cuando el webhook confirme el pago, usando el mismo eventID para deduplicar.
 */
type MetaEvent = 'ViewContent' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Lead' | 'Purchase';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function track(event: MetaEvent, data: Record<string, unknown> = {}, eventID?: string) {
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', event, data, eventID ? { eventID } : undefined);
    }
  } catch {
    /* el seguimiento nunca debe romper la compra */
  }
  if (import.meta.env.DEV || document.documentElement.dataset.demo === 'true') {
    console.info('[track]', event, data, eventID ?? '');
  }
}
