import axios from 'axios';
import type { ApiListResponse, Order, TokenPair, UserProfile } from '@/types/admin.types';

const TOKEN_KEY = 'airserviz_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * All traffic goes through the Kong gateway (/api → :8000): auth is public,
 * /api/orders requires the JWT that login returns.
 */
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await api.post<{ success: boolean; data: TokenPair }>('/auth/login', {
    email,
    password,
  });
  return data.data;
}

export async function getMe(): Promise<UserProfile> {
  const { data } = await api.get<{ success: boolean; data: UserProfile }>('/auth/me');
  return data.data;
}

export async function getOrders(): Promise<Order[]> {
  const { data } = await api.get<ApiListResponse<Order>>('/orders');
  return data.data;
}
