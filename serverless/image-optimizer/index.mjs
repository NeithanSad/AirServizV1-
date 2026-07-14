/**
 * AirServiz — image-optimizer Lambda
 *
 * Recibe una imagen (foto de perfil, imagen de servicio del catálogo o
 * evidencia de trabajo), la optimiza con sharp (resize + conversión a WebP)
 * y la sube a S3. Devuelve la URL pública para que el microservicio que la
 * invocó la persista (profiles.photoUrl / services.imageUrl).
 *
 * Soporta dos formas de invocación:
 *  1. Invocación directa (AWS SDK InvokeCommand desde user/catalog-service):
 *     { "imageBase64": "...", "filename": "perfil.jpg", "folder": "profiles" }
 *  2. API Gateway / Function URL (POST con body base64):
 *     event.body + event.isBase64Encoded
 *
 * Variables de entorno:
 *  - S3_BUCKET      (requerido) bucket destino
 *  - MAX_WIDTH      (default 1024) ancho máximo; nunca agranda
 *  - WEBP_QUALITY   (default 80)
 *  - S3_PUBLIC_BASE (opcional) CDN/base pública; default URL regional de S3
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

const s3 = new S3Client({});

const MAX_WIDTH = Number(process.env.MAX_WIDTH ?? 1024);
const WEBP_QUALITY = Number(process.env.WEBP_QUALITY ?? 80);

/** Núcleo puro (exportado para poder probarlo localmente sin AWS) */
export async function optimizeImage(inputBuffer) {
  const image = sharp(inputBuffer, { failOn: 'error' });
  const meta = await image.metadata();

  const output = await image
    .rotate() // respeta la orientación EXIF antes de descartar metadatos
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return {
    buffer: output,
    bytesIn: inputBuffer.length,
    bytesOut: output.length,
    originalFormat: meta.format,
    originalWidth: meta.width,
  };
}

function parsePayload(event) {
  // Forma 2: API Gateway / Function URL
  if (typeof event?.body === 'string') {
    const body = event.isBase64Encoded
      ? { imageBase64: event.body, filename: event.queryStringParameters?.filename }
      : JSON.parse(event.body);
    return body;
  }
  // Forma 1: invocación directa con payload JSON
  return event;
}

export const handler = async (event) => {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET env var is required');

  const { imageBase64, filename = 'image', folder = 'uploads' } = parsePayload(event) ?? {};
  if (!imageBase64) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'imageBase64 is required' }),
    };
  }

  const input = Buffer.from(imageBase64, 'base64');
  const { buffer, bytesIn, bytesOut, originalFormat } = await optimizeImage(input);

  const safeName = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const key = `${folder}/${randomUUID()}-${safeName}.webp`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const publicBase =
    process.env.S3_PUBLIC_BASE ??
    `https://${bucket}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`;

  const result = {
    success: true,
    key,
    url: `${publicBase}/${key}`,
    originalFormat,
    bytesIn,
    bytesOut,
    reduction: `${Math.round((1 - bytesOut / bytesIn) * 100)}%`,
  };

  // API Gateway espera statusCode/body; la invocación directa recibe el JSON tal cual
  if (typeof event?.body === 'string') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
  }
  return result;
};
