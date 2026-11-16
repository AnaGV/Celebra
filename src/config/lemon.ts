/**
 * Lemon Squeezy: datos públicos (no son secretos). La API key va solo en Cloudflare: LEMON_API_KEY.
 * Ojo: al pasar de modo prueba a modo real, el Variant ID cambia (Copy to Live Mode). Actualízalo aquí.
 */
export const lemon = {
  storeId: '513563',
  /** Variante del ebook "Fiestas que se recuerdan". */
  variantId: '2348869',
  /** Descuento del capítulo gratis (porcentaje sobre el libro). */
  descuentoPct: 20,
  /** Horas que dura el código único del capítulo gratis. */
  horasCodigo: 48,
  /**
   * Mientras no exista LEMON_API_KEY en Cloudflare, se envía este código compartido.
   * Hay que crearlo a mano en Lemon Squeezy (Discounts): mismo %, solo el libro, sin límite de usos.
   */
  codigoCompartido: 'CAPITULO20',
};
