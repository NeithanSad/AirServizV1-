import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getProfile, upsertProfile } from '@/services/catalogApi';
import { MapPinIcon, SaveIcon, UserIcon } from '@/components/Icons';
import './BusinessProfile.css';

/**
 * "Mi negocio" — business info shown to clients in the catalog.
 * Saving this profile is what makes the provider appear in the
 * client-app provider list (GET /profiles?role=PROVIDER).
 */
export default function BusinessProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    bio: '',
    photoUrl: '',
    phone: '',
    city: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((profile) => {
        if (profile) {
          setForm({
            fullName: profile.fullName ?? '',
            bio: profile.bio ?? '',
            photoUrl: profile.photoUrl ?? '',
            phone: profile.phone ?? '',
            city: profile.city ?? '',
            address: profile.address ?? '',
          });
        } else {
          setIsNew(true);
          setForm((f) => ({ ...f, fullName: user.fullName }));
        }
      })
      .catch(() => setMessage({ text: 'No se pudo cargar tu perfil', type: 'error' }))
      .finally(() => setLoading(false));
  }, [user]);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await upsertProfile(user.id, {
        fullName: form.fullName,
        role: 'PROVIDER',
        bio: form.bio || undefined,
        photoUrl: form.photoUrl || undefined,
        phone: form.phone || undefined,
        city: form.city || undefined,
        address: form.address || undefined,
      });
      setIsNew(false);
      setMessage({
        text: 'Perfil guardado — tu negocio ya es visible para los clientes',
        type: 'success',
      });
    } catch {
      setMessage({ text: 'Error al guardar el perfil', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="bp-loading">Cargando perfil…</div>;
  }

  return (
    <div className="bp-card">
      {isNew && (
        <div className="bp-banner">
          Completa la información de tu negocio para aparecer en el catálogo de clientes.
        </div>
      )}

      <div className="bp-header">
        {form.photoUrl ? (
          <img className="bp-photo" src={form.photoUrl} alt="Foto del negocio" />
        ) : (
          <div className="bp-photo bp-photo--placeholder">
            <UserIcon size={26} />
          </div>
        )}
        <div>
          <h3 className="bp-name">{form.fullName || 'Tu negocio'}</h3>
          {form.city && (
            <span className="bp-city">
              <MapPinIcon size={12} /> {form.city}
            </span>
          )}
        </div>
      </div>

      <form className="bp-form" onSubmit={handleSubmit}>
        <div className="bp-field">
          <label htmlFor="bp-fullName">Nombre del negocio</label>
          <input
            id="bp-fullName"
            value={form.fullName}
            required
            maxLength={120}
            onChange={(e) => update('fullName', e.target.value)}
            placeholder="ej. Mario Fontanería"
          />
        </div>

        <div className="bp-field">
          <label htmlFor="bp-bio">Descripción</label>
          <textarea
            id="bp-bio"
            value={form.bio}
            maxLength={300}
            onChange={(e) => update('bio', e.target.value)}
            placeholder="Cuenta a tus clientes qué haces y tu experiencia…"
          />
        </div>

        <div className="bp-field">
          <label htmlFor="bp-photoUrl">Foto (URL de imagen libre)</label>
          <input
            id="bp-photoUrl"
            type="url"
            value={form.photoUrl}
            onChange={(e) => update('photoUrl', e.target.value)}
            placeholder="https://randomuser.me/api/portraits/men/32.jpg"
          />
        </div>

        <div className="bp-grid">
          <div className="bp-field">
            <label htmlFor="bp-phone">Teléfono</label>
            <input
              id="bp-phone"
              value={form.phone}
              maxLength={30}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+52 555 123 4567"
            />
          </div>
          <div className="bp-field">
            <label htmlFor="bp-city">Ciudad</label>
            <input
              id="bp-city"
              value={form.city}
              maxLength={80}
              onChange={(e) => update('city', e.target.value)}
              placeholder="Ciudad de México"
            />
          </div>
        </div>

        <div className="bp-field">
          <label htmlFor="bp-address">Dirección</label>
          <input
            id="bp-address"
            value={form.address}
            maxLength={200}
            onChange={(e) => update('address', e.target.value)}
            placeholder="Av. Insurgentes Sur 1234"
          />
        </div>

        {message && <div className={`bp-alert bp-alert--${message.type}`}>{message.text}</div>}

        <button type="submit" className="bp-submit" disabled={saving}>
          <SaveIcon size={15} /> {saving ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </form>
    </div>
  );
}
