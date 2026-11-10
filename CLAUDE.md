# Celebra — contexto para Claude

Lee esto antes de trabajar en Celebra. Responde en español, con "tú", cercano y concreto. La dueña es **Ana** (ingeniera en computación, vive en Santiago de Chile). Su hermana **Yenny** y su mamá **Mirna** llevan el taller en Caripe.

## Qué es
- Taller familiar de fiestas en Caripe, Monagas, Venezuela: piñatas, arreglos, globos, chupeteras, toppers, cotillón y detalles hechos a mano. Empezó en el garaje de la casa.
- Web: somoscelebrave.com · Instagram: @somoscelebra.ve.
- Todo se vende por WhatsApp. Los packs van "a consultar por WhatsApp".
- Sellos de marca: "Tu idea, nuestra fiesta" y decir "En Celebra…". Colores: rosa #db3978, tinta #16171a, crema. Poco morado, porque satura la vista.

## Cómo está hecha la web
- Repositorio GitHub `AnaGV/Celebra`, rama `main`. Cada push se publica solo en Cloudflare (check "Workers Builds: celebra"). Un 504 de Cloudflare es pasajero: se reintenta con un commit vacío.
- Stack: Astro estático (`src/`) más un Cloudflare Worker (`worker/index.ts`) para las rutas `/api/*`, `/ref/*` e Instagram.
- R2 `celebra-fotos-cotizaciones` (binding FOTOS); correo con send_email; cron diario `0 12 * * *`.
- Probar en local: `npx astro build` y `npx wrangler dev --port 8788 --local`. El archivo `.dev.vars` (ignorado por git) tiene claves de prueba.
- Antes de cambios grandes: borrador, capturas y aprobación de Ana. Después, publicar.

### Mapa
| Ruta | Archivo | Qué es |
|---|---|---|
| / | src/pages/index.astro | Carrusel: el banner de Navidad (`XmasBanner.astro`) es la 1.ª lámina; se quita en enero. Club 10%, Instagram, ideas, mapa |
| /club/ | src/pages/club.astro + worker/club.ts | Cumpleaños de seres queridos; un código de 10% por persona o correo, válido para una compra |
| /salones/ | src/pages/salones.astro + src/config/directorio.ts | Directorio de Caripe; Celebra fija arriba, aliados primero con foto pequeña, "Reportar dato incorrecto" |
| /reservar/?a=id | src/pages/reservar.astro | Reserva con un aliado |
| /aliado/ | src/pages/aliado.astro | Panel del aliado (enlace privado `#<id>.<token>`, se recuerda en localStorage o se pega) |
| /admin/aliados/ | src/pages/admin/aliados.astro | Admin de Ana (clave CELEBRA_ADMIN_KEY) |
| /ref/<id> | worker/foto.ts | Fotos de referencia y capturas: se borran al descargar o a las 24 h; `?aliado=1` muestra el botón al panel |
| Instagram | worker/instagram.ts | Feed sincronizado a diario; comentarios aprobados por correo |

### Secretos (solo en Cloudflare, nunca en el chat ni en el código)
CELEBRA_FORM_KEY (la usa otra parte; no cambiarla), CELEBRA_ADMIN_KEY, IG_APP_ID, IG_APP_SECRET, IG_CONFIG_ID, IG_USER_ID. Token de Instagram en R2 `privado/ig.json`.

## Aliados (marketplace)
- Celebra trae clientes con publicidad. **Nunca cobra ni ve el dinero** (por el SENIAT): el cliente paga directo al aliado por Pago Móvil o Binance, y el aliado verifica en su panel.
- Planes: **Gratis** (activo; el cliente envía la reserva al WhatsApp del aliado con un botón) y **Pro** (próximamente; WhatsApp Cloud API, unos $0,02 por reserva). La publicidad se cobra aparte.
- Lógica de agenda: `src/lib/agenda.ts`, compartida por la página y el worker.
  - Horario por aliado: desde/hasta en minutos (puede pasar de 1440, la madrugada) y días de la semana.
  - Servicios por tipo: `hora` (minHoras), `evento` (duración fija) y `unidad` (cupo por día). `cantidad` = cupo simultáneo.
  - La reserva aparta 24 h. Si el día está lleno, el cliente puede mandar una "consulta de hora extra" que no aparta nada.
- Teléfonos: `src/lib/telefono.ts`. Un celular venezolano siempre se guarda con +58, y el cliente confirma su número antes de enviar. El número del aliado no se muestra en la página.
- R2: `aliados/<id>.json`, `aliados-fotos/<id>/1|2`, `reservas/<aliado>/<res>.json`.

## Reglas que no se rompen
1. Los secretos nunca van en el chat ni en el código.
2. Celebra no maneja pagos de aliados.
3. No publicar la dirección de la tienda ni del garaje.
4. El PDF completo del libro pagado nunca va en el repositorio ni en la web pública.
5. Las bajas de correo se respetan siempre.
6. Las fotos de referencia y las capturas de pago se borran solas.
7. No se modifican los productos de Celebra en las imágenes.
8. Nada de personajes con marca ni nombres de niños en nuestras composiciones.
9. Higgsfield solo cuando Ana lo pide. En Meta, solo la cuenta "Celebra Ads".

## Libros
- **Fiestas que se recuerdan** (32 págs., venta por Lemon Squeezy).
  - Falta: subir el PDF, el checkout link (apaga el modo de prueba), una compra de prueba, los datos de Pago Móvil y una "Lista de compras" con cantidades.
  - Los videos irán después con un QR a una página propia.
- **Mi Navidad hecha en casa**: portada v2 lista (escena de papel azul noche).
  - Imprimibles hechos: toppers, copos de nieve, cajas y reno con trineo.
  - Falta: medidas y materiales reales de Ana para las piñatas, chupeteras y vasos.

## Pendientes
- Primer aliado real.
- Decidir si se agrega un WhatsApp de respaldo y un campo "Dirección del local".
- Plan Pro y recordatorio mensual de "sigo activo".
- Llenar las categorías vacías del directorio.
- Blog "Taller abierto", otro día y sin agregarlo al menú de arriba.
- Foto de las tres para Quiénes somos.
- Meta: verificación de dominio y CAPI.
- Probar el resumen diario del Club.
- Automatización con n8n.
- Quitar el banner de Navidad en enero.
