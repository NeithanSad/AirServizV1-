import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe, type UserProfile } from '@/services/authApi';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(
    () => localStorage.getItem('airserviz_token'),
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem('airserviz_token'));

  useEffect(() => {
    const token = localStorage.getItem('airserviz_token');
    if (!token) { setIsLoading(false); return; }
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('airserviz_token');
        localStorage.removeItem('airserviz_refresh');
        setAccessToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(token: string, refreshToken: string) {
    localStorage.setItem('airserviz_token', token);
    localStorage.setItem('airserviz_refresh', refreshToken);
    setAccessToken(token);
    const profile = await getMe(token);
    localStorage.setItem('airserviz_client_id', profile.id); // needed by booking-service
    setUser(profile);
  }

  function logout() {
    localStorage.removeItem('airserviz_token');
    localStorage.removeItem('airserviz_refresh');
    localStorage.removeItem('airserviz_client_id');
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ accessToken, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
