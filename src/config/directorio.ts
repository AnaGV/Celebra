/**
 * Directorio de lugares y proveedores para fiestas en Caripe.
 * Lo curas tú: agrega, quita o edita entradas aquí.
 *
 * - placeId: identificador de Google Maps (el botón "Ver en Google Maps" lo usa). Opcional.
 * - tel: número con código de país, solo dígitos. Si es celular (412/414/416/424/426) se muestra
 *   "Ir al WhatsApp"; si es fijo (p. ej. 0292) se muestra "Llamar".
 * - Solo servicios que Celebra NO vende (nada de piñatas, decoración, globos ni cotillón).
 */

export const CATEGORIAS = [
  { id: 'lugares', nombre: 'Lugares para la fiesta', icono: '🏡' },
  { id: 'tortas', nombre: 'Tortas y dulces', icono: '🎂' },
  { id: 'pasapalos', nombre: 'Pasapalos y comida', icono: '🥟' },
  { id: 'sonido', nombre: 'Sonido y DJ', icono: '🎵' },
  { id: 'iluminacion', nombre: 'Iluminación', icono: '💡' },
  { id: 'mobiliario', nombre: 'Mesas, sillas y toldos', icono: '🪑' },
  { id: 'foto', nombre: 'Fotografía y video', icono: '📸' },
  { id: 'belleza', nombre: 'Maquillaje y peinado', icono: '💄' },
  { id: 'animacion', nombre: 'Animadores y recreación', icono: '🤹' },
  { id: 'vestidos', nombre: 'Vestidos y trajes', icono: '👗' },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]['id'];

export type Proveedor = {
  nombre: string;
  categorias: CategoriaId[];
  descripcion: string;
  zona?: string;
  tel?: string;
  instagram?: string;
  placeId?: string;
};

export const proveedores: Proveedor[] = [
  // Lugares
  { nombre: 'Finca La Floresta', categorias: ['lugares'], descripcion: 'Finca con amplias áreas verdes, piscina y cabañas.', zona: 'Caripe', tel: '584148523038', placeId: 'ChIJydYGj_MAM4wRLmDBn5fnD6A' },
  { nombre: 'Loma Paraíso', categorias: ['lugares'], descripcion: 'Posada de montaña con vista al valle y cabañas.', zona: 'Caripe', tel: '584129270984', placeId: 'ChIJix1sHPYAM4wRwIg92AnvljM' },
  { nombre: 'Cabañas Virgen del Valle', categorias: ['lugares'], descripcion: 'Cabañas con piscina, fuente y jardines.', zona: 'Caripe', placeId: 'ChIJmVkxsFgAM4wRNXf7kUIX4_M' },
  { nombre: 'La Coradeña', categorias: ['lugares'], descripcion: 'Finca agroturística con piscina, parque y zona de parrilla.', zona: 'Caripe', tel: '582924149409', placeId: 'ChIJi1VM7CcAM4wRcjWzIjveRZ8' },
  { nombre: 'Pueblo Pequeño', categorias: ['lugares'], descripcion: 'Complejo de cabañas con piscina y vistas a la montaña.', zona: 'Vía Cocollar', tel: '584249289270', placeId: 'ChIJwRP5j5oAM4wRDW3ztlp9wcw' },
  { nombre: 'Posada Villa Moruna', categorias: ['lugares'], descripcion: 'Casa colonial con jardines, parrilleras y parque infantil.', zona: 'San Agustín', tel: '582924148033', placeId: 'ChIJX2ZWwY6qM4wRQehP6Gh4hdM' },
  { nombre: 'Mandarinas Posada', categorias: ['lugares'], descripcion: 'Posada con cabañas y áreas comunes cuidadas.', zona: 'Caripe', tel: '584147694395', placeId: 'ChIJU8N3HP2rM4wRjGd7G9xio4c' },
  { nombre: 'Hacienda Campo Claro', categorias: ['lugares'], descripcion: 'Hacienda cafetalera con caballos y cabañas.', zona: 'Teresén', tel: '584144616246', placeId: 'ChIJxwlMwKQAM4wRjGRf4wf0aAM' },
  { nombre: 'Restaurante El Portón de Caripe', categorias: ['lugares'], descripcion: 'Restaurante familiar con estacionamiento, cerca del pueblo.', zona: 'Caripe', placeId: 'ChIJX0QqFPQAM4wR8xY-TtFXgmw' },
  { nombre: 'La Bodeguita 2707', categorias: ['lugares'], descripcion: 'Restaurante amplio, cómodo para grupos grandes.', zona: 'Av. Enrique Chaumer', tel: '584148300711', placeId: 'ChIJR4GvRVsBM4wR5wKT-GXu3nk' },
  { nombre: 'Enki Restaurant', categorias: ['lugares'], descripcion: 'Restaurante pequeño y acogedor para celebraciones íntimas.', zona: 'Av. Enrique Chaumer', tel: '584148625434', placeId: 'ChIJL9Z4LuEBM4wRs8RfhbrFjTk' },
  { nombre: 'Hadas Café', categorias: ['lugares', 'tortas'], descripcion: 'Restaurante de cocina regional y española, conocido por sus tortas.', zona: 'Caripe', tel: '582925451349', placeId: 'ChIJkVEFaKQAM4wRKWkB6v3DHCg' },
  // Tortas y dulces
  { nombre: 'Panadería y Pastelería San José', categorias: ['tortas'], descripcion: 'Panadería tradicional de Caripe con tortas y dulces.', zona: 'Caripe', tel: '582925451536', placeId: 'ChIJpWIPAqQAM4wR0daZJ6SkLEw' },
  { nombre: 'Panadería y Pastelería El Sol de Torrez', categorias: ['tortas'], descripcion: 'Pastelería con tortas y hojaldres, junto a la plaza.', zona: 'Av. Enrique Chaumer', tel: '584140205410', placeId: 'ChIJWbiioCcBM4wRz3FGVgwRkU8' },
  { nombre: 'Panadería y Pastelería La Fuente del Trigo', categorias: ['tortas'], descripcion: 'Panadería y pastelería con espacio para tomar café.', zona: 'Caripe', placeId: 'ChIJ7dla3ZAAM4wR4ESdpkXjMmA' },
  // Fotografía
  { nombre: 'SL Fotografía', categorias: ['foto'], descripcion: 'Fotografía de bodas, quince años y eventos.', zona: 'Caripe', tel: '584244472330', placeId: 'ChIJPWsMxqcBM4wR157iqw_dQdQ' },
  // Maquillaje y peinado
  { nombre: 'Salón de belleza Francimar', categorias: ['belleza'], descripcion: 'Peluquería para damas, caballeros y niños.', zona: 'Caripe', placeId: 'ChIJ8ZLHFicBM4wRX5zLR8MU_yM' },
  { nombre: 'La Peluquería de Mary', categorias: ['belleza'], descripcion: 'Peluquería y arreglos para ocasiones especiales.', zona: 'Caripe', tel: '584129490620', placeId: 'ChIJZ2dj-oKrM4wRxNT6ota3UR8' },
];
