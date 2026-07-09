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
  const actorId = localStorage.getItem('airserviz_actor_id');
  if (token)   cfg.headers.Authorization  = `Bearer ${token}`;
  if (actorId) cfg.headers['x-actor-id'] = actorId;
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
