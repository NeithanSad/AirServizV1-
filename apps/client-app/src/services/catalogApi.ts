import axios from 'axios';
import type { ApiResponse } from '@/types/order.types';
import type { ServiceOffering, ProviderProfile } from '@/types/catalog.types';

/**
 * Base URL: Vite proxies /api to the Kong gateway (http://localhost:8000),
 * same as production — Kong routes /api/services → catalog-service and
 * /api/profiles → user-service.
 */
const catalogApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

interface ListResponse<T> extends ApiResponse<T[]> {
  count: number;
}

/** GET /profiles?role=PROVIDER — powers the provider dropdown */
export async function getProviders(): Promise<ProviderProfile[]> {
  const { data } = await catalogApi.get<ListResponse<ProviderProfile>>('/profiles', {
    params: { role: 'PROVIDER' },
  });
  return data.data;
}

/** GET /services?providerId= — active services offered by one provider */
export async function getServicesByProvider(providerId: string): Promise<ServiceOffering[]> {
  const { data } = await catalogApi.get<ListResponse<ServiceOffering>>('/services', {
    params: { providerId },
  });
  return data.data;
}

/** GET /services — full active catalog (powers the explore grid) */
export async function getAllServices(): Promise<ServiceOffering[]> {
  const { data } = await catalogApi.get<ListResponse<ServiceOffering>>('/services');
  return data.data;
}
