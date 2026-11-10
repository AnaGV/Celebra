/**
 * Agenda de los aliados: horarios y cupos. La usan la página de reserva (navegador)
 * y el worker (para validar), así ambos calculan igual.
 *
 * Horas en minutos desde las 00:00 del día de la fiesta. "hasta" puede pasar de 1440
 * (ej. 1560 = 2:00 a. m. del día siguiente), porque las fiestas terminan tarde.
 */

export type Tipo = 'hora' | 'evento' | 'unidad';
export type ServicioAg = { id: string; nombre: string; precio: number; tipo: Tipo; unidad: string; duracion: number; minHoras: number; cantidad: number };
export type Horario = { desde: number; hasta: number; dias: number[] }; // dias: 0 = lunes … 6 = domingo
export type Ocupa = { id: string; cant: number; ini: number | null; fin: number | null };
export type Pedido = { id: string; cant: number; horas: number };

export const HORARIO_BASE: Horario = { desde: 9 * 60, hasta: 23 * 60, dias: [0, 1, 2, 3, 4, 5, 6] };
export const PASO = 60;

/** Pasa servicios viejos (con "unidad" libre) al formato con tipo. */
export function normServicio(s: any): ServicioAg {
  const u = String(s?.unidad || '').toLowerCase();
  const tipo: Tipo = s?.tipo === 'hora' || s?.tipo === 'evento' || s?.tipo === 'unidad' ? s.tipo : /hora/.test(u) ? 'hora' : /evento|fiesta|show|servicio/.test(u) || !u ? 'evento' : 'unidad';
  return {
    id: String(s?.id || ''), nombre: String(s?.nombre || ''), precio: Number(s?.precio) || 0, tipo,
    unidad: tipo === 'unidad' ? String(s?.unidad || 'unidad') : tipo === 'hora' ? 'hora' : 'evento',
    duracion: Math.max(1, Math.min(24, Math.round(Number(s?.duracion) || 4))),
    minHoras: Math.max(1, Math.min(24, Math.round(Number(s?.minHoras) || 1))),
    cantidad: Math.max(1, Math.min(999, Math.round(Number(s?.cantidad) || 1))),
  };
}

export function normHorario(h: any): Horario {
  const desde = Math.max(0, Math.min(23 * 60, Math.round(Number(h?.desde ?? HORARIO_BASE.desde) / PASO) * PASO));
  let hasta = Math.round(Number(h?.hasta ?? HORARIO_BASE.hasta) / PASO) * PASO;
  hasta = Math.max(desde + PASO, Math.min(30 * 60, hasta));
  const dias = Array.isArray(h?.dias) ? [...new Set(h.dias.map(Number).filter((d: number) => d >= 0 && d <= 6))].sort() as number[] : HORARIO_BASE.dias;
  return { desde, hasta, dias };
}

/** Día de la semana de una fecha YYYY-MM-DD (0 = lunes). */
export const diaSemana = (f: string) => (new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7;

export function horaTxt(min: number) {
  const m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60;
  const h12 = h % 12 || 12;
  return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Minutos que ocupa un pedido (null = no usa horario, ej. sillas por unidad). */
export function duracionDe(s: ServicioAg, p: Pedido): number | null {
  if (s.tipo === 'hora') return Math.max(s.minHoras, p.horas || s.minHoras) * 60;
  if (s.tipo === 'evento') return s.duracion * 60;
  return null;
}

/** ¿Cabe el pedido ese día empezando a "hora"? Devuelve el motivo si no cabe. */
export function cabe(servicios: ServicioAg[], horario: Horario, ocupado: Ocupa[], pedido: Pedido[], hora: number): string | null {
  for (const p of pedido) {
    const s = servicios.find((x) => x.id === p.id); if (!s) return 'servicio';
    const dur = duracionDe(s, p);
    if (dur == null) {
      const usado = ocupado.filter((o) => o.id === s.id).reduce((t, o) => t + o.cant, 0);
      if (usado + p.cant > s.cantidad) return s.nombre;
      continue;
    }
    if (hora < horario.desde || hora + dur > horario.hasta) return 'horario';
    for (let h = hora; h < hora + dur; h += PASO) {
      const usado = ocupado.filter((o) => o.id === s.id && o.ini != null && o.fin != null && o.ini <= h && h < o.fin).reduce((t, o) => t + o.cant, 0);
      if (usado + p.cant > s.cantidad) return s.nombre;
    }
  }
  return null;
}

/** Horas de inicio posibles ese día para el pedido. */
export function horasLibres(servicios: ServicioAg[], horario: Horario, ocupado: Ocupa[], pedido: Pedido[]): number[] {
  const out: number[] = [];
  for (let h = horario.desde; h < horario.hasta; h += PASO) if (!cabe(servicios, horario, ocupado, pedido, h)) out.push(h);
  return out;
}

/** Pedido mínimo de cada servicio, para saber si un día está lleno cuando aún no eligen nada. */
export const pedidoMinimo = (s: ServicioAg): Pedido => ({ id: s.id, cant: 1, horas: s.minHoras });

/** Precio de una línea. */
export function subtotal(s: ServicioAg, p: Pedido) {
  return s.tipo === 'hora' ? s.precio * Math.max(s.minHoras, p.horas) * p.cant : s.precio * p.cant;
}
