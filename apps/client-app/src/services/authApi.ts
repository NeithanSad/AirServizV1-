import axios from 'axios';

const authApi = axios.create({
  baseURL: '/api/auth',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
}

export async function register(
  email: string,
  password: string,
  fullName: string,
): Promise<TokenPair> {
  const { data } = await authApi.post<{ success: boolean; data: TokenPair }>('/register', {
    email,
    password,
    fullName,
    role: 'CLIENT',
  });
  return data.data;
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await authApi.post<{ success: boolean; data: TokenPair }>('/login', {
    email,
    password,
  });
  return data.data;
}

export async function getMe(accessToken: string): Promise<UserProfile> {
  const { data } = await authApi.get<{ success: boolean; data: UserProfile }>('/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.data;
}
