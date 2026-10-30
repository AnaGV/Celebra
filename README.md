# Landing de libros · Taller de Fiestas

Borrador funcional de la tienda: landing en Astro (estática) + checkout con métodos de pago por país.
Se publica en **Cloudflare Pages**.

## Comandos

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # genera /dist
```

## Dónde se configura todo

| Archivo | Qué contiene |
|---|---|
| `src/config/site.ts` | Marca, contacto, local de Caripe, datos de Binance y Pago Móvil, tasa, Pixel, `demoMode` |
| `src/config/products.ts` | Productos, precio, países donde se muestran, métodos por producto, link de Lemon Squeezy |
| `src/components/Checkout.astro` | Flujo de compra (país → producto → método → pago) |
| `src/pages/index.astro` | Secciones de la landing |
| `functions/api/orders.ts` | Recibe pagos manuales y reservas (Pages Function) |

> `site.ts` y `products.ts` llegan al navegador. **Nunca pongas claves secretas ahí.**
> Las claves van como variables secretas en Cloudflare y solo se usan en `/functions`.

## Métodos de pago

| Método | Países | Cómo funciona hoy | Siguiente fase |
|---|---|---|---|
| Tarjeta / PayPal (Lemon Squeezy) | Todos | Overlay con Lemon.js; en el navegador interno de Instagram/Facebook redirige a página completa | Webhook → D1 + email propio + Purchase por Conversions API |
| Binance Pay (USDT) | Todos | Muestra Pay ID + referencia única; el cliente envía el ID de orden | Cron que verifica con API de solo lectura y entrega automática |
| Pago Móvil | Venezuela | Muestra datos bancarios y monto en Bs; el cliente envía la referencia | Verificación automática (p. ej. Pabilo) + tasa BCV automática |
| Pagar al retirar | Venezuela, solo libro impreso | Reserva con código, vence en N días | Panel para marcar retirado |

## Pasar de demo a real

1. Crear la tienda en Lemon Squeezy, subir el ebook y copiar el *checkout link* en `products.ts → lemonCheckoutUrl`.
2. Completar datos reales de Binance, Pago Móvil, contacto y local en `site.ts`.
3. Cambiar `demoMode: false`.
4. (Opcional) Pegar el ID del Pixel de Meta en `site.ts → tracking.metaPixelId`.
5. Crear la base D1 y el binding `DB` para guardar pedidos (ver esquema abajo).

```sql
CREATE TABLE orders (
  ref TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  method TEXT NOT NULL,
  country TEXT,
  cf_country TEXT,
  amount_usd REAL,
  email TEXT, name TEXT, phone TEXT,
  binance_order_id TEXT, bank_reference TEXT,
  codigo TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TEXT NOT NULL
);
```

## Publicar en Cloudflare Pages

1. Subir el proyecto a un repo de GitHub.
2. Cloudflare → Workers & Pages → Create → Pages → conectar el repo.
3. Build command: `npm run build` · Output directory: `dist`.
4. Custom domains → agregar tu dominio.

## Contenido de ejemplo a reemplazar

- Portada (SVG en `BookCover.astro`), foto de la autora, fotos del local.
- Título, índice, beneficios y precio del libro.
- Opiniones (solo reales y con permiso).
- Textos legales: revisarlos con un abogado o contador.
