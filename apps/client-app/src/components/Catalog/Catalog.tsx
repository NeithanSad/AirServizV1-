import { useEffect, useMemo, useState } from 'react';
import { getAllServices, getProviders } from '@/services/catalogApi';
import type { ProviderProfile, ServiceOffering, ServiceCategory } from '@/types/catalog.types';
import { CATEGORY_LABELS } from '@/types/catalog.types';
import { MapPinIcon } from '@/components/Icons';
import BookingModal from './BookingModal';
import './Catalog.css';

interface CatalogProps {
  /** Called after a successful booking so the parent can switch to "Mis solicitudes" */
  onBooked: () => void;
}

export default function Catalog({ onBooked }: CatalogProps) {
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ServiceCategory | 'ALL'>('ALL');
  const [selected, setSelected] = useState<ServiceOffering | null>(null);

  useEffect(() => {
    Promise.all([getAllServices(), getProviders()])
      .then(([svc, prov]) => {
        setServices(svc);
        setProviders(prov);
      })
      .catch(() => setError('No se pudo cargar el catálogo. Verifica que los servicios estén activos.'))
      .finally(() => setLoading(false));
  }, []);

  const providerById = useMemo(
    () => new Map(providers.map((p) => [p.userId, p])),
    [providers],
  );

  // Only categories that actually have services
  const categories = useMemo(() => {
    const present = new Set(services.map((s) => s.category));
    return (Object.keys(CATEGORY_LABELS) as ServiceCategory[]).filter((c) => present.has(c));
  }, [services]);

  const visible =
    category === 'ALL' ? services : services.filter((s) => s.category === category);

  return (
    <div className="catalog">
      {/* ── Category pills ──────────────────────────────────────────────── */}
      <div className="catalog__filters">
        <button
          className={`catalog__pill ${category === 'ALL' ? 'catalog__pill--active' : ''}`}
          onClick={() => setCategory('ALL')}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={`catalog__pill ${category === c ? 'catalog__pill--active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* ── States ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="catalog__grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="catalog-card catalog-card--skeleton" />
          ))}
        </div>
      )}

      {error && <div className="catalog__error">{error}</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="catalog__empty">No hay servicios en esta categoría todavía.</div>
      )}

      {/* ── Cards grid ──────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="catalog__grid">
          {visible.map((service) => {
            const provider = providerById.get(service.providerId);
            return (
              <article
                key={service.id}
                className="catalog-card"
                onClick={() => setSelected(service)}
              >
                <div className="catalog-card__media">
                  {service.imageUrl ? (
                    <img src={service.imageUrl} alt={service.name} loading="lazy" />
                  ) : (
                    <div className="catalog-card__placeholder" />
                  )}
                  <span className="catalog-card__chip">
                    {CATEGORY_LABELS[service.category]}
                  </span>
                </div>

                <div className="catalog-card__body">
                  <h3 className="catalog-card__name">{service.name}</h3>

                  {provider && (
                    <div className="catalog-card__provider">
                      {provider.photoUrl && (
                        <img
                          className="catalog-card__avatar"
                          src={provider.photoUrl}
                          alt={provider.fullName}
                        />
                      )}
                      <span className="catalog-card__provider-name">{provider.fullName}</span>
                      {provider.city && (
                        <span className="catalog-card__city">
                          <MapPinIcon size={12} /> {provider.city}
                        </span>
                      )}
                    </div>
                  )}

                  {service.description && (
                    <p className="catalog-card__desc">{service.description}</p>
                  )}

                  <div className="catalog-card__price">
                    <strong>${Number(service.price).toFixed(2)}</strong>
                    <span> / servicio</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Booking modal ───────────────────────────────────────────────── */}
      {selected && (
        <BookingModal
          service={selected}
          provider={providerById.get(selected.providerId) ?? null}
          onClose={() => setSelected(null)}
          onBooked={() => {
            setSelected(null);
            onBooked();
          }}
        />
      )}
    </div>
  );
}
