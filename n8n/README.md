# Workflow n8n: venta con Lemon Squeezy

Archivo: `celebra-venta-lemon-squeezy.json`

## Qué hace

1. **Webhook Lemon Squeezy** recibe cada venta.
2. **Verificar firma y preparar pedido** comprueba que el aviso viene de Lemon Squeezy (firma `X-Signature`, HMAC SHA-256) y descarta todo lo que no sea un pedido pagado.
3. En paralelo:
   - **Guardar pedido en Google Sheets**: una fila por venta en la hoja `Pedidos`.
   - **Enviar compra a Meta (CAPI)**: evento `Purchase` con el email cifrado (SHA-256), el valor y un `event_id` único para no contar dos veces la misma venta.
   - **Avisarme por email**: te llega un correo con el detalle de la venta.

El cobro y la entrega del ebook los hace Lemon Squeezy. Si n8n está caído, la venta igual se completa; solo se pierden el registro, el aviso y el evento a Meta de ese momento.

## Cómo instalarlo

1. En n8n: **Workflows → Import from File** y elige el JSON.
2. Variables de entorno en el VPS (archivo de configuración de n8n o Docker):
   ```
   NODE_FUNCTION_ALLOW_BUILTIN=crypto
   LEMON_SIGNING_SECRET=el_secreto_de_firma_del_webhook
   META_PIXEL_ID=1337008795078996
   META_CAPI_TOKEN=tu_token_de_conversions_api
   ```
   Si tu instalación bloquea `$env` en los nodos, pon `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`.
3. **Google Sheets**: crea una hoja con una pestaña `Pedidos` y estas columnas en la fila 1:
   `fecha, pedido, identificador, referencia, pais, cliente, email, producto, variante, total_usd, moneda, metodo, email_hash, event_time`.
   En el nodo, conecta tu cuenta de Google y reemplaza `ID_DE_TU_GOOGLE_SHEET` (está en la URL de la hoja).
4. **Email**: en el nodo *Avisarme por email*, crea una credencial SMTP con tu correo de Hostinger y cambia `TU-DOMINIO.com`.
5. **Meta CAPI**: en el nodo HTTP, cambia `TU-DOMINIO.com` por tu dominio. El token se crea en Administrador de eventos → tu Pixel → Configuración → API de conversiones.
6. Activa el workflow y copia la **URL de producción** del webhook (`https://n8n.TU-DOMINIO.com/webhook/lemon-squeezy`).
7. En Lemon Squeezy: **Settings → Webhooks → +**, pega esa URL, define el *Signing secret* (el mismo de `LEMON_SIGNING_SECRET`) y marca el evento `order_created`.
8. Prueba en **modo test** de Lemon Squeezy: haz una compra de prueba y revisa que aparezca la fila, el email y el evento en el Administrador de eventos de Meta (pestaña *Probar eventos*).

## Deduplicación con el Pixel

Si el Pixel del navegador también envía `Purchase`, debe usar el mismo `event_id` (el `identifier` del pedido de Lemon Squeezy) para que Meta lo cuente una sola vez. Si no puedes pasar ese dato al navegador, envía `Purchase` solo desde este workflow.

Este workflow también marca en la hoja `Leads` que la persona compró (deja de recibir emails) y, si pagó con código, que el código quedó usado.

---

# Capítulo gratis, códigos de descuento y pagos manuales

| Archivo | Qué hace |
|---|---|
| `celebra-lead-capitulo-gratis.json` | Recibe el formulario de la landing, crea un código único en Lemon Squeezy, guarda el lead, envía el email 1 con el PDF y el código, avisa a Meta (Lead). |
| `celebra-seguimiento-leads.json` | Cada hora: email 2 (tip de la piñata) a las 20 h, email 3 cuando quedan 8 h, y marca los códigos vencidos. No escribe a quien ya compró o se dio de baja. |
| `celebra-validar-codigo.json` | El checkout pregunta si un código vale (Binance y Pago Móvil). |
| `celebra-confirmar-pago-manual.json` | Tu formulario privado para confirmar un pago por Binance, Pago Móvil o en el local: guarda el pedido, envía el ebook con su recibo, marca el código como usado y lo borra de Lemon Squeezy. |

## Hoja de Google: pestaña `Leads`

Columnas en la fila 1:
`fecha, nombre, email, pais, zona, codigo, descuento_usd, vence, ls_discount_id, estado, seguimiento, compro, baja, origen, event_id`

- `estado`: emitido, usado o vencido.
- `seguimiento`: 0, 1 o 2 (cuántos emails de seguimiento recibió).
- `compro` y `baja`: escribe `sí` para que deje de recibir emails.

## Variables de entorno nuevas en el VPS

```
CELEBRA_FORM_KEY=una_clave_larga_al_azar        # la misma en Cloudflare Pages
LEMON_API_KEY=tu_api_key_de_lemon_squeezy
LEMON_STORE_ID=12345
LEMON_EBOOK_VARIANT_ID=67890
LEMON_TEST_MODE=true                            # false cuando vendas de verdad
LEAD_DISCOUNT_CENTS=200                         # USD 2; igual que leadDiscountUsd en site.ts
LEAD_CODE_HOURS=48
SITE_DOMAIN=TU-DOMINIO.com
MAIL_FROM=hola@TU-DOMINIO.com
IG_VIDEO_PINATA=https://www.instagram.com/reel/...
EBOOK_PATH=/home/node/.n8n-files/fiestas-que-se-recuerdan.pdf
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
```

`EBOOK_PATH` es el PDF completo guardado en el VPS (nunca en la web pública). En n8n 1.x el nodo de leer archivos solo puede leer dentro de la carpeta permitida (`N8N_RESTRICT_FILE_ACCESS_TO`); pon el PDF ahí.

## Email

Los nodos de email usan una credencial SMTP. El correo de Hostinger tiene límites bajos (alrededor de 100 envíos al día), así que para los leads usa un proveedor transaccional con SMTP, por ejemplo Brevo o Resend, y verifica tu dominio (SPF y DKIM) para no caer en spam.

## Cómo se protege cada código

- **Un solo uso:** Lemon Squeezy lo crea con `max_redemptions: 1`. En pagos manuales, el workflow de confirmación lo marca `usado` y lo borra de Lemon Squeezy.
- **Vencimiento:** `expires_at` en Lemon Squeezy y la columna `vence` en la hoja.
- **Uno por persona:** si el email ya existe en `Leads`, se reenvía el mismo código.
- **Solo el ebook:** el código está limitado a la variante del ebook.

## Formulario "Confirmar pago manual"

Al activar el workflow, n8n te da una URL de formulario. Protégela con la credencial *Basic Auth* (usuario y clave que solo tú conoces) y guárdala en el celular. Úsala solo después de ver el pago en Binance o en tu banco.

## Prueba completa (modo test)

1. `LEMON_TEST_MODE=true`, workflows activos.
2. Pide el capítulo en la landing con tu email: llega el email 1 y aparece la fila en `Leads`.
3. Abre el botón del email: el checkout se abre con el código puesto.
4. Paga con la tarjeta de prueba de Lemon Squeezy: en `Leads` debe quedar `compro = sí` y `estado = usado`.
5. Intenta usar el mismo código otra vez: Lemon Squeezy y el checkout lo rechazan.
6. Prueba un pago por Pago Móvil con otro email y confírmalo en el formulario: llega el ebook adjunto.

---

# Opiniones del libro

| Archivo | Qué hace |
|---|---|
| `celebra-pedir-opinion-7-dias.json` | Cada día a las 10:00 revisa `Pedidos` y, a quien compró hace 7 días o más, le envía un email pidiendo su opinión: un botón a Google Maps y otro al formulario. Se le pide a todas las clientas, no solo a las contentas, y nunca a cambio de un descuento (reglas de Google). |
| `celebra-formulario-opinion.json` | Formulario público de opinión. Guarda cada respuesta en la pestaña `Opiniones` y te avisa por email. |

- En la pestaña `Pedidos` agrega la columna `opinion_pedida` (queda en `sí` cuando ya se envió el email).
- Crea la pestaña `Opiniones` con: `fecha, nombre, ciudad, email, estrellas, opinion, permiso, publicada`.
- Solo publica en la web las que tengan `permiso = sí`. Cuando la pongas en la página, cambia `publicada` a `sí`.
- Variable nueva en el VPS: `N8N_FORM_OPINION_URL` = la URL de producción del formulario de opinión (la ves al activar el workflow).

## Próximo workflow

- Binance automático: consulta periódica del historial de Binance Pay (clave de solo lectura, IP del VPS) para confirmar pagos sin el formulario.
