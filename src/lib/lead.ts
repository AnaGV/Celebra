import { site } from '../config/site';
import { track } from './analytics';

/** Conecta un formulario de "capítulo gratis" con /api/lead (n8n). */
export function wireLeadForm(form: HTMLFormElement, onDone: (email: string) => void) {
  const errorEl = form.querySelector<HTMLElement>('[data-lead-error]');
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = btn.textContent;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector<HTMLInputElement>('input[name="email"]')!;
    const nombre = form.querySelector<HTMLInputElement>('input[name="nombre"]');
    const empresa = form.querySelector<HTMLInputElement>('input[name="empresa"]');
    const value = email.value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    email.setAttribute('aria-invalid', valid ? 'false' : 'true');
    if (!valid) {
      if (errorEl) { errorEl.textContent = 'Revisa tu email: así no te lo podemos enviar.'; errorEl.hidden = false; }
      email.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    if (errorEl) errorEl.hidden = true;
    const eventId = `lead-${crypto.randomUUID()}`;
    const params = new URLSearchParams(location.search);
    const utm = ['utm_source', 'utm_medium', 'utm_campaign'].map((k) => params.get(k) ?? '').join('|');
    try {
      if (site.demoMode) {
        await new Promise((r) => setTimeout(r, 600));
      } else {
        const res = await fetch(site.payments.leadEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nombre: nombre?.value.trim() ?? '', email: value,
            pais: document.documentElement.dataset.pais ?? 'OTRO',
            origen: form.dataset.origen ?? 'landing', utm, event_id: eventId, empresa: empresa?.value ?? '',
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || 'error');
      }
      track('Lead', { content_name: 'capitulo-2' }, eventId);
      onDone(value);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = label;
      if (errorEl) {
        errorEl.textContent = err instanceof Error && err.message !== 'error' ? err.message : 'No pudimos enviarlo. Inténtalo de nuevo en un momento.';
        errorEl.hidden = false;
      }
    }
  });
}
