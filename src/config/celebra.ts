/**
 * Contenido del negocio Celebra (portada, tipos de fiesta, packs, servicios y salones).
 * Edita aquí: los textos y precios se actualizan en todas las páginas.
 *
 * Precios: deja `priceUsd: null` para mostrar "Precio a consultar".
 * Cuando tengas el precio, pon el número (ej. 35) y aparece "Desde USD 35".
 */

export interface TipoFiesta {
  slug: string;
  name: string;
  short: string;
  intro: string;
  /** Lo que hacemos en el taller para este tipo de fiesta. */
  hacemos: string[];
  /** Ideas de temáticas para inspirar. */
  tematicas: string[];
  bg: string;
  ink: string;
  /** Dibujo SVG (viewBox 0 0 160 160). */
  art: string;
  /** Ilustración de la marca (public/img/marca). */
  img: string;
}

const S = 'stroke="#4a1a4f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';

export const tipos: TipoFiesta[] = [
  {
    slug: 'cumpleanos-infantil',
    name: 'Cumpleaños infantil',
    short: 'Piñata, chupetera y mesa con su personaje favorito.',
    intro: 'El cumpleaños es nuestra especialidad: piñatas a medida, chupeteras y todo para que la mesa principal combine con la temática que tu peque elija.',
    hacemos: ['Piñata temática a medida', 'Chupetera a juego', 'Cartel con nombre y edad', 'Kit de arco de globos', 'Bolsitas de recuerdo'],
    tematicas: ['Estrellita arcoíris', 'Dinosaurios', 'Sirenas', 'Superhéroes', 'Unicornio', 'Granja'],
    bg: '#fbe6ee',
    ink: '#b8285f',
    img: '/img/marca/globos.webp',
    art: `<rect x="40" y="78" width="80" height="50" rx="8" fill="#f8bbd0" ${S}/><rect x="52" y="56" width="56" height="24" rx="6" fill="#c5e3f6" ${S}/><path d="M80 30v24M66 36v18M94 36v18" ${S}/><path d="M80 22c-4 4-4 8 0 10 4-2 4-6 0-10zM66 28c-4 4-4 8 0 10 4-2 4-6 0-10zM94 28c-4 4-4 8 0 10 4-2 4-6 0-10z" fill="#fde9a6" ${S}/><path d="M40 100q10 8 20 0t20 0 20 0 20 0" fill="none" ${S}/>`,
  },
  {
    slug: 'baby-shower',
    name: 'Baby shower y revelación',
    short: 'Decoración suave y la piñata de la revelación.',
    intro: 'Para esperar al bebé con todo: decoración en tonos suaves, carteles y la piñata o caja para revelar si es niña o niño.',
    hacemos: ['Piñata de revelación', 'Cartel de bienvenida', 'Kit de globos en tonos pastel', 'Centros de mesa', 'Recuerdos para invitados'],
    tematicas: ['Ositos', 'Nubes y estrellas', 'Safari bebé', 'Flores', '¿Niña o niño?'],
    bg: '#e3f5ff',
    ink: '#0f6fa3',
    img: '/img/marca/regalo.webp',
    art: `<path d="M50 70h60l-6 50H56z" fill="#c5e3f6" ${S}/><path d="M50 70q30-40 60 0" fill="#e0d1f5" ${S}/><circle cx="62" cy="128" r="9" fill="#ffffff" ${S}/><circle cx="98" cy="128" r="9" fill="#ffffff" ${S}/><path d="M110 70l14-14" ${S}/><path d="M36 40l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#fde9a6" ${S}/>`,
  },
  {
    slug: 'bautizo-comunion',
    name: 'Bautizo y primera comunión',
    short: 'Detalles delicados en blanco y tonos claros.',
    intro: 'Celebraciones delicadas, con decoración en blanco, dorado y tonos claros, carteles con el nombre y recuerdos para los invitados.',
    hacemos: ['Cartel con nombre y fecha', 'Centros de mesa', 'Kit de globos blanco y dorado', 'Recuerdos personalizados', 'Decoración de mesa principal'],
    tematicas: ['Palomas', 'Ángeles', 'Flores blancas', 'Dorado y blanco'],
    bg: '#fef9dc',
    ink: '#866a00',
    img: '/img/marca/varita.webp',
    art: `<path d="M44 92c10-30 40-36 62-22-8 2-12 8-12 14 14-4 24 0 30 8-16 0-26 6-34 14-14 14-40 10-46-14z" fill="#ffffff" ${S}/><circle cx="96" cy="72" r="2.5" fill="#4a1a4f"/><path d="M106 70l10-2-8 8" fill="#fde9a6" ${S}/><path d="M60 44l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fde9a6" ${S}/>`,
  },
  {
    slug: 'xv-graduaciones',
    name: 'XV años y graduaciones',
    short: 'Carteles, globos y detalles para la gran noche.',
    intro: 'Para quinceañeras y graduados: carteles grandes, globos con los colores elegidos, centros de mesa y detalles para las fotos.',
    hacemos: ['Cartel gigante con nombre', 'Kit de globos y números', 'Centros de mesa', 'Fondo para fotos', 'Recuerdos'],
    tematicas: ['Princesa', 'Dorado y negro', 'París', 'Neón', 'Promoción con los colores del colegio'],
    bg: '#f1eaff',
    ink: '#6043e1',
    img: '/img/marca/corona.webp',
    art: `<path d="M44 96l10-40 16 22 10-30 10 30 16-22 10 40z" fill="#fde9a6" ${S}/><rect x="44" y="96" width="72" height="12" rx="3" fill="#e0d1f5" ${S}/><circle cx="54" cy="54" r="5" fill="#f8bbd0" ${S}/><circle cx="80" cy="44" r="5" fill="#c5e3f6" ${S}/><circle cx="106" cy="54" r="5" fill="#c8f0dc" ${S}/>`,
  },
];

export interface Pack {
  id: string;
  name: string;
  invitados: string;
  /** Hasta cuántos invitados recomienda este pack (para el selector). */
  max: number;
  incluye: string[];
  priceUsd: number | null;
  destacado?: boolean;
}

/** BORRADOR: revisa qué incluye cada pack y pon los precios. */
export const packs: Pack[] = [
  {
    id: 'mini',
    name: 'Pack Mini',
    invitados: 'Hasta 15 invitados',
    max: 15,
    incluye: ['Piñata temática mediana', 'Cartel con nombre y edad', '15 bolsitas de recuerdo armadas', '1 docena de globos en tus colores'],
    priceUsd: null,
  },
  {
    id: 'fiesta',
    name: 'Pack Fiesta',
    invitados: '16 a 30 invitados',
    max: 30,
    incluye: ['Piñata temática grande', 'Chupetera a juego', 'Cartel con nombre y edad', '30 bolsitas de recuerdo armadas', 'Kit de arco de globos para armar en casa'],
    priceUsd: null,
    destacado: true,
  },
  {
    id: 'grande',
    name: 'Pack Grande',
    invitados: '31 a 50 invitados',
    max: 50,
    incluye: ['Piñata temática grande', 'Chupetera a juego', 'Cartel grande con nombre y edad', '50 bolsitas de recuerdo armadas', 'Kit de arco de globos completo', 'Centros de mesa'],
    priceUsd: null,
  },
  {
    id: 'mega',
    name: 'Pack a medida',
    invitados: 'Más de 50 invitados',
    max: 9999,
    incluye: ['Todo lo del Pack Grande', 'Cantidades a tu medida', 'Decoración extra para la mesa principal', 'Te asesoramos por WhatsApp'],
    priceUsd: null,
  },
];

export interface Servicio {
  name: string;
  desc: string;
  /** propio = lo hace Celebra; aliado = proveedor que publica con nosotras. */
  kind: 'propio' | 'aliado';
  icon: string;
}

export const servicios: Servicio[] = [
  { name: 'Piñatas a medida', desc: 'Con la forma, la temática y el tamaño que elijas.', kind: 'propio', icon: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z' },
  { name: 'Chupeteras', desc: 'Para la mesa dulce, a juego con la piñata.', kind: 'propio', icon: 'M7 21V11M12 21V8M17 21V12M7 11a3 3 0 100-6 3 3 0 000 6zM12 8a3 3 0 100-6 3 3 0 000 6zM17 12a3 3 0 100-6 3 3 0 000 6z' },
  { name: 'Decoración y globos', desc: 'Kits de arco de globos, carteles y centros de mesa.', kind: 'propio', icon: 'M12 3a5 5 0 015 5c0 4-5 8-5 8s-5-4-5-8a5 5 0 015-5zM12 16v5' },
  { name: 'Invitaciones digitales', desc: 'Diseñadas con tu temática, listas para WhatsApp.', kind: 'propio', icon: 'M4 6h16v12H4zM4 7l8 6 8-6' },
  { name: 'Recuerdos', desc: 'Bolsitas armadas, con etiqueta y los colores de la fiesta.', kind: 'propio', icon: 'M5 9h14l-1 11H6zM9 9V7a3 3 0 016 0v2' },
  { name: 'Tortas y mesa dulce', desc: 'Reposteras de Caripe que trabajan con nosotras.', kind: 'aliado', icon: 'M4 21h16M5 21v-7h14v7M8 14V10h8v4M12 10V6' },
  { name: 'Sonido y animación', desc: 'Música, animadores y show para los niños.', kind: 'aliado', icon: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z' },
  { name: 'Mobiliario y toldos', desc: 'Sillas, mesas y toldos para tu fiesta.', kind: 'aliado', icon: 'M3 10l9-6 9 6M5 10v10M19 10v10M5 15h14' },
];

export interface Salon {
  name: string;
  zona: string;
  capacidad: string;
  incluye: string[];
  whatsapp: string;
  instagram?: string;
  foto?: string;
}

/** Salones de Caripe publicados. Agrega uno por cada dueño que se sume. */
export const salones: Salon[] = [];
