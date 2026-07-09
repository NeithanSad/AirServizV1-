import { useState } from 'react';
import { createOrder } from '@/services/api';
import type { ProviderProfile, ServiceOffering } from '@/types/catalog.types';
import { CATEGORY_LABELS } from '@/types/catalog.types';
import { CalendarIcon, CheckIcon, MapPinIcon, XIcon } from '@/components/Icons';
import './Catalog.css';

interface BookingModalProps {
  service: ServiceOffering;
  provider: ProviderProfile | null;
  onClose: () => void;
  onBooked: () => void;
}

/** datetime-local needs "YYYY-MM-DDTHH:mm" in local time */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function BookingModal({ service, provider, onClose, onBooked }: BookingModalProps) {
  // Default: tomorrow at 10:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const [scheduledDate, setScheduledDate] = useState(toLocalInputValue(tomorrow));
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const total = Number(service.price) * quantity;
  const minDate = toLocalInputValue(new Date());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOrder({
        providerId: service.providerId,
        items: [
          {
            serviceId: service.id,
            quantity,
            unitPrice: Number(service.price),
          },
        ],
        scheduledDate: new Date(scheduledDate).toISOString(),
        notes: notes || undefined,
      });
      setSuccess(true);
    } catch {
      setError('No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" aria-label="Cerrar" onClick={onClose}>
          <XIcon size={18} />
        </button>

        {/* ── Success state ───────────────────────────────────────────── */}
        {success ? (
          <div className="modal__success">
            <div className="modal__success-icon">
              <CheckIcon size={28} />
            </div>
            <h3>Solicitud enviada</h3>
            <p>
              {provider?.fullName ?? 'El proveedor'} recibió tu solicitud para el{' '}
              <strong>
                {new Date(scheduledDate).toLocaleDateString('es-MX', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>
              . Te notificaremos cuando responda.
            </p>
            <button className="btn-submit" onClick={onBooked}>
              Ver mis solicitudes
            </button>
          </div>
        ) : (
          <>
            {/* ── Service header ──────────────────────────────────────── */}
            {service.imageUrl && (
              <img className="modal__image" src={service.imageUrl} alt={service.name} />
            )}
            <div className="modal__header">
              <span className="catalog-card__chip modal__chip">
                {CATEGORY_LABELS[service.category]}
              </span>
              <h3 className="modal__title">{service.name}</h3>
              {provider && (
                <div className="modal__provider">
                  {provider.photoUrl && (
                    <img src={provider.photoUrl} alt={provider.fullName} />
                  )}
                  <div>
                    <span className="modal__provider-name">{provider.fullName}</span>
                    {provider.city && (
                      <span className="modal__provider-city">
                        <MapPinIcon size={12} /> {provider.city}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Booking form ────────────────────────────────────────── */}
            <form className="modal__form" onSubmit={handleSubmit}>
              <div className="field">
                <label className="field__label" htmlFor="scheduledDate">
                  <CalendarIcon size={13} /> Fecha y hora deseada
                </label>
                <input
                  id="scheduledDate"
                  type="datetime-local"
                  className="field__input"
                  value={scheduledDate}
                  min={minDate}
                  required
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="quantity">
                  Cantidad
                </label>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  className="field__input"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="notes">
                  Notas (opcional)
                </label>
                <textarea
                  id="notes"
                  className="field__textarea"
                  placeholder="Detalles para el proveedor…"
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="modal__total">
                <span>Total</span>
                <strong>${total.toFixed(2)}</strong>
              </div>

              {error && <div className="alert alert--error">{error}</div>}

              <button type="submit" className="btn-submit" disabled={submitting}>
                {submitting ? 'Enviando…' : 'Solicitar servicio'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
