import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { login, register } from '@/services/authApi';
import './LoginForm.css';

export default function LoginForm() {
  const { login: authLogin } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const tokens = tab === 'login'
        ? await login(email, password)
        : await register(email, password, fullName);
      await authLogin(tokens.accessToken, tokens.refreshToken);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Error de conexión'));
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-dot" />
          <span className="login-logo-text">AirServiz</span>
          <span className="login-badge">PROVEEDOR</span>
        </div>
        <h1 className="login-title">{tab === 'login' ? 'Acceso proveedores' : 'Registrarse como proveedor'}</h1>
        <p className="login-sub">Gestiona y confirma las órdenes de tus clientes</p>

        <div className="login-tabs">
          <button className={`login-tab ${tab==='login'?'login-tab--active':''}`}
            onClick={() => { setTab('login'); setError(''); }}>Ingresar</button>
          <button className={`login-tab ${tab==='register'?'login-tab--active':''}`}
            onClick={() => { setTab('register'); setError(''); }}>Registrarse</button>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {tab === 'register' && (
            <div className="login-field">
              <label className="login-label">Nombre del negocio / persona</label>
              <input className="login-input" type="text" placeholder="Ej. Servicios López"
                value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="login-field">
            <label className="login-label">Email</label>
            <input className="login-input" type="email" placeholder="proveedor@airserviz.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="login-field">
            <label className="login-label">Contraseña</label>
            <input className="login-input" type="password" placeholder="Mínimo 8 caracteres"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <div className="login-alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Procesando...' : tab === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
