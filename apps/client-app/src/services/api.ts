import axios from 'axios';
import type { ApiResponse, CreateOrderPayload, Order, OrderStatus } from '@/types/order.types';

/**
 * Base URL: Vite proxies /api to the Kong gateway (http://localhost:8000),
 * same as production — Kong routes /api/orders → booking-service.
 */
const bookingApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// Attach auth token on every request (filled in after login flow)
bookingApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('airserviz_token');
  const clientId = localStorage.getItem('airserviz_client_id');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (clientId) {
    config.headers['x-client-id'] = clientId;
    config.headers['x-actor-id'] = clientId; // status updates performed as the client
  }
  return config;
});

/**
 * POST /orders
 * Creates a new order and triggers the order_created Kafka event.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const { data } = await bookingApi.post<ApiResponse<Order>>('/orders', payload);
  return data.data;
}

/** GET /orders?clientId= — the client's own requests */
export async function getMyOrders(clientId: string): Promise<Order[]> {
  const { data } = await bookingApi.get<ApiResponse<Order[]>>('/orders', {
    params: { clientId },
  });
  return data.data;
}

/**
 * PATCH /orders/:id/status — client actions:
 * accept a proposed date (CONFIRMED) or cancel the request (CANCELLED).
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const { data } = await bookingApi.patch<ApiResponse<Order>>(`/orders/${orderId}/status`, {
    status,
  });
  return data.data;
}
