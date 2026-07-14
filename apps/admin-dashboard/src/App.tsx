import { useCallback, useEffect, useState } from 'react';
import { LoginForm } from './components/LoginForm';
import { OrdersTable } from './components/OrdersTable';
import { clearToken, getMe, getToken } from './services/adminApi';
import type { UserProfile } from './types/admin.types';

export default function App() {
  const [admin, setAdmin] = useState<UserProfile | null>(null);
  const [checking, setChecking] = useState(true);

  // Restore session: validate the stored token AND that the user is an ADMIN
  const restoreSession = useCallback(async () => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    try {
      const me = await getMe();
      if (me.role === 'ADMIN') {
        setAdmin(me);
      } else {
        clearToken();
      }
    } catch {
      clearToken();
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const logout = () => {
    clearToken();
    setAdmin(null);
  };

  if (checking) return <div className="centered muted">Cargando…</div>;

  if (!admin) return <LoginForm onLogin={setAdmin} />;

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">
          <span className="brand-badge" />
          <h1>AirServiz</h1>
          <span className="brand-tag">Admin</span>
        </div>
        <div className="userbox">
          <span>{admin.fullName}</span>
          <button className="btn-ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="content">
        <OrdersTable />
      </main>
    </div>
  );
}
