/**
 * Configuración central del sitio.
 * Todo lo que cambia entre negocios (marca, contacto, pagos) vive aquí.
 * IMPORTANTE: este archivo se envía al navegador. Nunca pongas aquí claves secretas
 * (API keys de Binance, Lemon Squeezy, Resend…). Esas van como variables de entorno
 * en Cloudflare y solo se usan dentro de /functions.
 */

export type CountryCode = 'VE' | 'CL' | 'OTRO';
export type PaymentMethodId = 'lemon' | 'binance' | 'pago_movil' | 'pagar_en_local';

export const site = {
  /** Mientras sea true, ningún pago es real: el checkout simula cada paso. */
  demoMode: true,

  brand: {
    name: 'Taller de Fiestas',
    tagline: 'Libros y piñatas hechos en Caripe',
    authorName: 'Nombre de la autora',
    email: 'hola@tudominio.com',
  },

  contact: {
    /** Número en formato internacional, sin + ni espacios (para wa.me). */
    whatsapp: '56945167340',
    whatsappDisplay: '+56 9 4516 7340',
    /** WhatsApp del local de Caripe (pedidos de piñatas y retiros). */
    localWhatsapp: '584148503387',
    localWhatsappDisplay: '+58 414 850 3387',
    /** Ficha de Google Maps (sin publicar la dirección en la web). */
    googleMaps: 'https://maps.google.com/?cid=14490972937344566958',
    googleReview: 'https://search.google.com/local/writereview?placeid=ChIJ1UP5xAmpM4wRrsY4LBxHGsk',
    instagram: 'https://instagram.com/tu_cuenta',
    instagramHandle: '@tu_cuenta',
    tiktok: 'https://tiktok.com/@tu_cuenta',
    facebook: 'https://facebook.com/tu_pagina',
  },

  location: {
    name: 'Local Taller de Fiestas',
    address: 'Calle Bolívar, sector centro, Caripe, estado Monagas, Venezuela',
    hours: [
      { days: 'Lunes a viernes', time: '9:00 a 18:00' },
      { days: 'Sábado', time: '9:00 a 14:00' },
      { days: 'Domingo', time: 'Cerrado' },
    ],
    /** Enlace "Abrir en Google Maps" (compartir → copiar enlace). */
    mapsUrl: 'https://maps.google.com/?q=Caripe,Monagas,Venezuela',
    /** Iframe de Google Maps (compartir → insertar un mapa → copiar src). Vacío = no se muestra. */
    mapsEmbedUrl: '',
  },

  payments: {
    /** Métodos visibles según el país del comprador. El orden es el orden en pantalla. */
    byCountry: {
      VE: ['binance', 'pago_movil', 'lemon'],
      CL: ['lemon', 'binance'],
      OTRO: ['lemon', 'binance'],
    } satisfies Record<CountryCode, PaymentMethodId[]>,

    lemon: {
      /** Opcional: ID de tienda para cargar Lemon.js (overlay). */
      scriptUrl: 'https://app.lemonsqueezy.com/js/lemon.js',
    },

    binance: {
      payId: '000000000',
      accountName: 'Nombre en Binance',
      network: 'Binance Pay (sin comisión entre usuarios de Binance)',
    },

    pagoMovil: {
      bank: 'Banco de Venezuela (0102)',
      phone: '0414-000-0000',
      idDocument: 'V-00.000.000',
      holder: 'Nombre del titular',
      /** Tasa referencial Bs por USD. TODO: leerla automáticamente (BCV) desde /functions. */
      rate: 40,
      rateLabel: 'Tasa referencial de ejemplo',
    },

    pickup: {
      reservationDays: 3,
    },

    /** Endpoint que recibe pagos manuales (Binance, Pago Móvil, reservas). */
    ordersEndpoint: '/api/orders',
    leadEndpoint: '/api/lead',
    codeEndpoint: '/api/codigo',
    /** Descuento del código que recibe quien pide el capítulo gratis. Debe coincidir con LEAD_DISCOUNT_CENTS en n8n. */
    leadDiscountUsd: 2,
  },

  tracking: {
    /** ID del Pixel de Meta. Vacío = no se carga. */
    metaPixelId: '1337008795078996',
  },
} as const;

export const countries: { code: CountryCode; label: string }[] = [
  { code: 'VE', label: 'Venezuela' },
  { code: 'CL', label: 'Chile' },
  { code: 'OTRO', label: 'Otro país' },
];
