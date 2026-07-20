import axios from 'axios';
import type { Order, OrderStatus } from '@/types/order.types';

const api = axios.create({ baseURL: '/api/orders', timeout: 10_000 });

api.interceptors.request.use((cfg) => {
  const token    = localStorage.getItem('airserviz_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  // x-actor-id ya no se envia: el backend deriva la identidad del JWT
  // verificado. Confiar en una cabecera del cliente permitia suplantacion.
  return cfg;
});

export async function getOrders(providerId?: string): Promise<Order[]> {
  const params = providerId ? { providerId } : {};
  const { data } = await api.get<{ data: Order[] }>('', { params });
  return data.data;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  proposedDate?: string,
): Promise<Order> {
  const body: Record<string, unknown> = { status };
  if (proposedDate) body.proposedDate = proposedDate;
  const { data } = await api.patch<{ data: Order }>(`/${orderId}/status`, body);
  return data.data;
}
