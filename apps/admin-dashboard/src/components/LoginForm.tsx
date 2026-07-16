import { FormEvent, useState } from 'react';
import { clearToken, getMe, login, setToken } from '@/services/adminApi';
import type { UserProfile } from '@/types/admin.types';

interface Props {
  onLogin: (admin: UserProfile) => void;
}

export function LoginForm({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await login(email, password);
      setToken(tokens.accessToken);
      const me = await getMe();
      if (me.role !== 'ADMIN') {
        clearToken();
        setError('Acceso denegado: esta consola requiere el rol ADMIN.');
        return;
      }
      onLogin(me);
    } catch {
      clearToken();
      setError('Credenciales inválidas o servicio no disponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand centered-row">
          <span className="brand-badge" />
          <h1>AirServiz</h1>
          <span className="brand-tag">Admin</span>
        </div>
        <p className="muted">Consola de administración — transacciones del marketplace</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@airserviz.dev"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
          />
        </label>

        {error && <div className="error-box">{error}</div>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  );
}
