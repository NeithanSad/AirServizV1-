import axios from 'axios';

const api = axios.create({ baseURL: '/api/auth', timeout: 10_000 });

export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number; }
export interface UserProfile { id: string; email: string; fullName: string; role: string; }

export async function register(email: string, password: string, fullName: string): Promise<TokenPair> {
  const { data } = await api.post<{ success: boolean; data: TokenPair }>('/register', {
    email, password, fullName, role: 'PROVIDER',
  });
  return data.data;
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await api.post<{ success: boolean; data: TokenPair }>('/login', { email, password });
  return data.data;
}

export async function getMe(token: string): Promise<UserProfile> {
  const { data } = await api.get<{ success: boolean; data: UserProfile }>('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
}
