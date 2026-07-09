import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/Login/LoginForm';
import OrdersDashboard from '@/components/OrdersDashboard/OrdersDashboard';
import ServicesManager from '@/components/ServicesManager/ServicesManager';
import BusinessProfile from '@/components/BusinessProfile/BusinessProfile';
import { getProfile, upsertProfile } from '@/services/catalogApi';
import { InboxIcon, GridIcon, BriefcaseIcon } from '@/components/Icons';

type Tab = 'orders' | 'services' | 'business';

// ── Layout after login ────────────────────────────────────────────────────────
function ProviderDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');

  // Ensure a minimal profile exists so this provider appears in the client
  // catalog immediately after registering; details are edited in "Mi negocio".
  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((profile) => {
        if (!profile) {
          return upsertProfile(user.id, { fullName: user.fullName, role: 'PROVIDER' }).then(() => undefined);
        }
      })
      .catch(() => { /* user-service offline — profile can be created later */ });
  }, [user]);

  const tabs: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
    { id: 'orders', label: 'Solicitudes', icon: <InboxIcon size={15} /> },
    { id: 'services', label: 'Mis servicios', icon: <GridIcon size={15} /> },
    { id: 'business', label: 'Mi negocio', icon: <BriefcaseIcon size={15} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* Navbar */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--color-brand)',
            borderRadius: 7,
          }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
            AirServiz
          </span>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            background: 'var(--color-brand-light)',
            color: 'var(--color-brand-dark)',
            padding: '0.15rem 0.55rem',
            borderRadius: 12,
            marginLeft: '0.15rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Proveedor
          </span>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: '0.25rem' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                border: 'none',
                borderRadius: 999,
                background: tab === t.id ? 'var(--color-text)' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--color-text-muted)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {user?.fullName}
          </span>
          <button
            onClick={logout}
            style={{
              padding: '0.35rem 0.875rem',
              border: '1.5px solid var(--color-border)',
              borderRadius: 6,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        padding: '1.25rem',
        maxWidth: 1280,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        {tab === 'orders' && <OrdersDashboard />}
        {tab === 'services' && <ServicesManager />}
        {tab === 'business' && <BusinessProfile />}
      </main>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function AppInner() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.9rem',
      }}>
        Cargando...
      </div>
    );
  }

  return user ? <ProviderDashboard /> : <LoginForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
