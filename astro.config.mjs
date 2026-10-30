import { defineConfig } from 'astro/config';

// Sitio 100% estático: se publica en Cloudflare Pages.
// El backend (pedidos manuales, webhooks, emails) vive en /functions (Pages Functions).
export default defineConfig({
  site: 'https://tudominio.com', // TODO: reemplazar por el dominio real
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      // Scripts pequeños quedan inline: menos peticiones, carga más rápida desde Instagram.
      assetsInlineLimit: 100_000,
    },
  },
});
