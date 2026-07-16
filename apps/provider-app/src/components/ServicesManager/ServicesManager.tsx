import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getMyServices,
  createService,
  deactivateService,
  uploadServiceImage,
} from '@/services/catalogApi';
import type { ServiceOffering, ServiceCategory, CreateServicePayload } from '@/types/catalog.types';
import { CATEGORY_LABELS } from '@/types/catalog.types';
import { PlusIcon, TrashIcon, XIcon } from '@/components/Icons';
import './ServicesManager.css';

const EMPTY_FORM: CreateServicePayload = {
  name: '',
  description: '',
  price: 0,
  category: 'OTROS',
  imageUrl: '',
};

/** "Mis servicios" — the provider's own catalog offerings (shown to clients) */
export default function ServicesManager() {
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateServicePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPG, PNG, WebP…).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('La imagen no debe superar 4 MB.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadServiceImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      setError('No se pudo subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  const fetchServices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setServices(await getMyServices(user.id));
      setError(null);
    } catch {
      setError('No se pudieron cargar tus servicios');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createService({
        ...form,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        price: Number(form.price),
      });
      setServices((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError('Error al publicar el servicio. Revisa los datos.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError('No se pudo eliminar el servicio');
    }
  }

  return (
    <div className="sm">
      {/* Toolbar */}
      <div className="sm-toolbar">
        <span className="sm-count">
          {services.length} servicio{services.length === 1 ? '' : 's'} publicado{services.length === 1 ? '' : 's'}
        </span>
        <button className="sm-add-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <><XIcon size={14} /> Cerrar</> : <><PlusIcon size={14} /> Publicar servicio</>}
        </button>
      </div>

      {error && <div className="sm-alert">{error}</div>}

      {/* Create form */}
      {showForm && (
        <form className="sm-form" onSubmit={handleCreate}>
          <div className="sm-form-grid">
            <div className="sm-field sm-field--full">
              <label htmlFor="sm-name">Nombre del servicio</label>
              <input
                id="sm-name"
                value={form.name}
                required
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ej. Reparación de fugas de agua"
              />
            </div>

            <div className="sm-field">
              <label htmlFor="sm-price">Precio (USD)</label>
              <input
                id="sm-price"
                type="number"
                min={0.01}
                step="0.01"
                required
                value={form.price || ''}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                placeholder="150.00"
              />
            </div>

            <div className="sm-field">
              <label htmlFor="sm-category">Categoría</label>
              <select
                id="sm-category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as ServiceCategory }))
                }
              >
                {(Object.keys(CATEGORY_LABELS) as ServiceCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div className="sm-field sm-field--full">
              <label htmlFor="sm-desc">Descripción</label>
              <textarea
                id="sm-desc"
                value={form.description}
                maxLength={500}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Qué incluye el servicio…"
              />
            </div>

            <div className="sm-field sm-field--full">
              <label htmlFor="sm-image">Imagen del servicio</label>
              <input
                id="sm-image"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={uploading}
              />
              {uploading && (
                <span className="sm-upload-hint">Optimizando y subiendo imagen…</span>
              )}
              {form.imageUrl && !uploading && (
                <div className="sm-image-preview">
                  <img src={form.imageUrl} alt="Vista previa del servicio" />
                  <button
                    type="button"
                    className="sm-image-remove"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                  >
                    Quitar imagen
                  </button>
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="sm-submit" disabled={saving || uploading}>
            {saving ? 'Publicando…' : uploading ? 'Subiendo imagen…' : 'Publicar'}
          </button>
        </form>
      )}

      {/* Services grid */}
      {loading ? (
        <div className="sm-empty">Cargando servicios…</div>
      ) : services.length === 0 && !showForm ? (
        <div className="sm-empty">
          Aún no has publicado servicios. Publica el primero para aparecer en el catálogo.
        </div>
      ) : (
        <div className="sm-grid">
          {services.map((s) => (
            <article key={s.id} className="sm-card">
              <div className="sm-card-media">
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt={s.name} loading="lazy" />
                ) : (
                  <div className="sm-card-placeholder" />
                )}
                <span className="sm-card-chip">{CATEGORY_LABELS[s.category]}</span>
              </div>
              <div className="sm-card-body">
                <h4 className="sm-card-name">{s.name}</h4>
                {s.description && <p className="sm-card-desc">{s.description}</p>}
                <div className="sm-card-footer">
                  <strong className="sm-card-price">${Number(s.price).toFixed(2)}</strong>
                  <button
                    className="sm-delete-btn"
                    aria-label="Eliminar servicio"
                    title="Eliminar del catálogo"
                    onClick={() => handleDeactivate(s.id)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
