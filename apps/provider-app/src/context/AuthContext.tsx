import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe, type UserProfile } from '@/services/authApi';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem('airserviz_token'));

  useEffect(() => {
    const token = localStorage.getItem('airserviz_token');
    if (!token) { setIsLoading(false); return; }
    getMe(token)
      .then((profile) => {
        if (profile.role !== 'PROVIDER' && profile.role !== 'ADMIN') {
          // Only providers/admins can use this app
          localStorage.clear();
        } else {
          setUser(profile);
        }
      })
      .catch(() => localStorage.clear())
      .finally(() => setIsLoading(false));
  }, []);

  async function login(token: string, refreshToken: string) {
    localStorage.setItem('airserviz_token', token);
    localStorage.setItem('airserviz_refresh', refreshToken);
    const profile = await getMe(token);
    localStorage.setItem('airserviz_actor_id', profile.id);
    setUser(profile);
  }

  function logout() {
    localStorage.removeItem('airserviz_token');
    localStorage.removeItem('airserviz_refresh');
    localStorage.removeItem('airserviz_actor_id');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
