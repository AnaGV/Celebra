/**
 * Agenda del taller (parte 1): anticipación mínima y peso de trabajo de cada producto.
 * Acordado con Ana el 11 nov 2026. Nunca se bloquea un pedido: si falta tiempo, el cotizador
 * avisa al cliente, le ofrece lo disponible en el taller y marca el WhatsApp con ⚠️.
 * Para cambiar un número, edítalo aquí.
 */
export const ANTICIPACION_DIAS: Record<string, number> = {
  pack: 10, // pack personalizado: diseño, medidas, que todo combine
  'Piñata': 1, // sencilla: incluso el mismo día si hay en el taller; elaborada ~3 días
  'Chupetera': 3,
  'Cotillón': 5, // suelen pedir 10 a 15 unidades armadas
  'Bolsitas de recuerdo': 3,
  'Globos y decoración': 2,
  'Cartel con nombre': 2,
  'Invitación digital': 1,
  otro: 3,
};

/** Peso de trabajo (para la parte 2: semáforo de carga por fecha). */
export const PESO: Record<string, number> = {
  pack: 4,
  'Piñata': 1, // elaborada: 2
  'Chupetera': 2,
  'Cotillón': 2,
  'Bolsitas de recuerdo': 1,
  'Globos y decoración': 1,
  'Cartel con nombre': 1,
  'Invitación digital': 0,
  otro: 1,
};

/** Cuántas cosas confirmadas para un mismo día lo marcan como «muy pedido» (parte 2). */
export const TOPE_DIA = 4;
