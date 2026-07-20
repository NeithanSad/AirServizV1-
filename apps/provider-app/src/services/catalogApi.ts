import axios from 'axios';
import type {
  ServiceOffering,
  CreateServicePayload,
  ProviderProfile,
  UpsertProfilePayload,
} from '@/types/catalog.types';

/**
 * Vite proxy: /api/services → catalog-service (3004),
 *             /api/profiles → user-service (3005)
 */
const api = axios.create({ baseURL: '/api', timeout: 10_000 });

api.interceptors.request.use((cfg) => {
  const token   = localStorage.getItem('airserviz_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  // x-actor-id ya no se envia: el backend deriva la identidad del JWT
  // verificado. Confiar en una cabecera del cliente permitia suplantacion.
  return cfg;
});

// ── Services (catalog-service) ─────────────────────────────────────────────
export async function getMyServices(providerId: string): Promise<ServiceOffering[]> {
  const { data } = await api.get<{ data: ServiceOffering[] }>('/services', {
    params: { providerId },
  });
  return data.data;
}

export async function createService(payload: CreateServicePayload): Promise<ServiceOffering> {
  const { data } = await api.post<{ data: ServiceOffering }>('/services', payload);
  return data.data;
}

export async function deactivateService(serviceId: string): Promise<void> {
  await api.delete(`/services/${serviceId}`);
}

/**
 * Sube la imagen del servicio desde el dispositivo: la convierte a base64,
 * la manda a catalog-service (POST /services/media), que la optimiza con la
 * Lambda y la sube a S3. Devuelve la URL pública para guardarla en el servicio.
 */
export async function uploadServiceImage(file: File): Promise<string> {
  const imageBase64 = await fileToBase64(file);
  const { data } = await api.post<{ data: { url: string } }>('/services/media', {
    imageBase64,
    filename: file.name,
  });
  return data.data.url;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // readAsDataURL da "data:image/jpeg;base64,XXXX" — la Lambda quiere solo XXXX
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// ── Profile (user-service) ─────────────────────────────────────────────────
export async function getProfile(userId: string): Promise<ProviderProfile | null> {
  try {
    const { data } = await api.get<{ data: ProviderProfile }>(`/profiles/${userId}`);
    return data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export async function upsertProfile(
  userId: string,
  payload: UpsertProfilePayload,
): Promise<ProviderProfile> {
  const { data } = await api.put<{ data: ProviderProfile }>(`/profiles/${userId}`, payload);
  return data.data;
}
