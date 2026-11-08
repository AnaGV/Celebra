// Descarga los fondos del banner (generados en Higgsfield) y los guarda livianos en webp.
// Corre antes de cada build. Si ya existen o falla la descarga, no detiene el build.
import { existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const BASE = 'https://d8j0ntlcm91z4.cloudfront.net/user_3Cbo2zq0qxGZTgFPhK0IqS5V73e/';
const fondos = {
  'fondo-1': 'hf_20261108_003255_5a8c3a1f-addf-4e1c-83d8-e24dfd8648d0.png',
  'fondo-2': 'hf_20261108_003254_7295ad91-ccc4-4a0f-9600-81f422d87cb7.png',
  'fondo-3': 'hf_20261108_003255_23da25c9-d009-4470-b21a-cd2340defe45.png',
};
const dir = 'public/img/banner';
mkdirSync(dir, { recursive: true });
for (const [nombre, archivo] of Object.entries(fondos)) {
  const grande = `${dir}/${nombre}.webp`;
  const chico = `${dir}/${nombre}-m.webp`;
  if (existsSync(grande) && existsSync(chico)) continue;
  try {
    const r = await fetch(BASE + archivo);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await sharp(buf).resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(grande);
    await sharp(buf).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 74 }).toFile(chico);
    console.log('fondo listo:', nombre);
  } catch (e) {
    console.warn('No se pudo bajar', nombre, '-', e.message, '(se usa el color de respaldo)');
  }
}
