import type { CountryCode, PaymentMethodId } from './site';

export type Product = {
  id: string;
  kind: 'digital' | 'fisico';
  name: string;
  shortName: string;
  /** Precio en USD. Para Pago Móvil se convierte a Bs con la tasa de site.ts. */
  priceUsd: number;
  format: string;
  delivery: string;
  /** Países donde se muestra el producto. 'ALL' = todos. */
  countries: CountryCode[] | 'ALL';
  /** Si se define, reemplaza los métodos de pago del país para este producto. */
  methods?: PaymentMethodId[];
  /** URL de checkout de Lemon Squeezy (Share → Checkout link). Vacío = modo demo. */
  lemonCheckoutUrl?: string;
};

export const products: Product[] = [
  {
    id: 'ebook-fiestas',
    kind: 'digital',
    name: 'Fiestas que se recuerdan (ebook)',
    shortName: 'Ebook',
    priceUsd: 7, // precio recomendado de lanzamiento (ver revisión de precio)
    format: 'PDF y EPUB · 148 páginas',
    delivery: 'Llega a tu email apenas se confirma el pago',
    countries: 'ALL',
    lemonCheckoutUrl: '',
  },
  {
    id: 'libro-fisico-caripe',
    kind: 'fisico',
    name: 'Fiestas que se recuerdan (libro impreso)',
    shortName: 'Libro impreso',
    priceUsd: 18,
    format: 'Tapa blanda · 148 páginas a color',
    delivery: 'Retiro en el local de Caripe',
    countries: ['VE'],
    methods: ['pago_movil', 'binance', 'pagar_en_local'],
  },
];

export const mainProduct = products[0];
