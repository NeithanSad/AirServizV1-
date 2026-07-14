/**
 * Prueba local del pipeline de optimización (sin AWS): genera una imagen
 * PNG de 2000×1500 con sharp, la pasa por optimizeImage() y verifica que
 * salga un WebP más pequeño y con el resize aplicado.
 *
 *   node test-local.mjs
 */
import sharp from 'sharp';
import { optimizeImage } from './index.mjs';

const input = await sharp({
  create: {
    width: 2000,
    height: 1500,
    channels: 3,
    background: { r: 232, g: 83, b: 42 }, // naranja AirServiz
  },
})
  .composite([
    {
      input: Buffer.from(
        `<svg width="2000" height="1500"><circle cx="1000" cy="750" r="500" fill="white"/><text x="1000" y="780" font-size="120" text-anchor="middle" fill="#1F1F23">AirServiz</text></svg>`,
      ),
    },
  ])
  .png()
  .toBuffer();

const { buffer, bytesIn, bytesOut, originalFormat, originalWidth } = await optimizeImage(input);
const outMeta = await sharp(buffer).metadata();

console.log(`entrada : ${originalFormat} ${originalWidth}px — ${(bytesIn / 1024).toFixed(1)} KB`);
console.log(`salida  : ${outMeta.format} ${outMeta.width}px — ${(bytesOut / 1024).toFixed(1)} KB`);
console.log(`reducción: ${Math.round((1 - bytesOut / bytesIn) * 100)}%`);

if (outMeta.format !== 'webp') throw new Error('FALLO: la salida no es webp');
if (outMeta.width !== 1024) throw new Error(`FALLO: ancho ${outMeta.width}, esperado 1024`);
if (bytesOut >= bytesIn) throw new Error('FALLO: la imagen no se redujo');
console.log('OK — pipeline sharp verificado');
