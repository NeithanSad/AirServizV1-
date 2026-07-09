import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getMyOrders, updateOrderStatus } from '@/services/api';
import { getAllServices, getProviders } from '@/services/catalogApi';
import { getMyPayments, payPayment } from '@/services/paymentsApi';
import type { Order, OrderStatus } from '@/types/order.types';
import type { ProviderProfile, ServiceOffering } from '@/types/catalog.types';
import type { Payment } from '@/types/payment.types';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  XIcon,
  CreditCardIcon,
  AlertIcon,
} from '@/components/Icons';
import './MyRequests.css';

const REFRESH_INTERVAL = 10_000;

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Esperando respuesta',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  RESCHEDULE_PROPOSED: 'Nueva fecha propuesta',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyRequests() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const [orderData, paymentData] = await Promise.all([
          getMyOrders(user.id),
          getMyPayments(user.id).catch(() => [] as Payment[]), // payment-service optional
        ]);
        setOrders(orderData);
        setPayments(paymentData);
        setError(null);
      } catch {
        if (!silent) setError('No se pudieron cargar tus solicitudes');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Catalog data to resolve names/photos (best-effort)
  useEffect(() => {
    getAllServices().then(setServices).catch(() => {});
    getProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(() => fetchOrders(true), REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const providerById = useMemo(
    () => new Map(providers.map((p) => [p.userId, p])),
    [providers],
  );
  const paymentByOrder = useMemo(
    () => new Map(payments.map((p) => [p.orderId, p])),
    [payments],
  );

  async function respondToProposal(orderId: string, status: OrderStatus) {
    setActionLoading(orderId);
    try {
      const updated = await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch {
      setError('No se pudo actualizar la solicitud');
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePay(payment: Payment, outcome: 'success' | 'fail') {
    setPayingId(payment.id);
    try {
      const updated = await payPayment(payment.id, outcome);
      setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setError('No se pudo procesar el pago');
    } finally {
      setPayingId(null);
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="requests__empty">
        <ClockIcon size={28} />
        <span>Cargando tus solicitudes…</span>
      </div>
    );
  }

  return (
    <div className="requests">
      {error && <div className="alert alert--error">{error}</div>}

      {orders.length === 0 && !loading && (
        <div className="requests__empty">
          <CalendarIcon size={28} />
          <strong>Aún no tienes solicitudes</strong>
          <span>Explora el catálogo y solicita tu primer servicio.</span>
        </div>
      )}

      {orders.map((order) => {
        const provider = providerById.get(order.providerId);
        const busy = actionLoading === order.id;
        return (
          <article key={order.id} className="request-card">
            {/* Header: provider + status */}
            <div className="request-card__header">
              <div className="request-card__provider">
                {provider?.photoUrl && <img src={provider.photoUrl} alt="" />}
                <div>
                  <span className="request-card__provider-name">
                    {provider?.fullName ?? `Proveedor ${order.providerId.slice(0, 8)}`}
                  </span>
                  <span className="request-card__id">#{order.id.slice(0, 8)}</span>
                </div>
              </div>
              <span className={`request-badge request-badge--${order.status}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>

            {/* Items */}
            <ul className="request-card__items">
              {order.items.map((item, i) => {
                const svc = serviceById.get(item.serviceId);
                return (
                  <li key={i}>
                    <span>{svc?.name ?? `Servicio ${item.serviceId.slice(0, 8)}`}</span>
                    <span className="request-card__item-detail">
                      {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Dates */}
            <div className="request-card__dates">
              {order.scheduledDate && (
                <div className="request-card__date">
                  <CalendarIcon size={14} />
                  <span>
                    Fecha {order.status === 'RESCHEDULE_PROPOSED' ? 'solicitada' : 'programada'}:{' '}
                    <strong>{formatDate(order.scheduledDate)}</strong>
                  </span>
                </div>
              )}
              {order.status === 'RESCHEDULE_PROPOSED' && order.proposedDate && (
                <div className="request-card__date request-card__date--proposed">
                  <ClockIcon size={14} />
                  <span>
                    El proveedor propone: <strong>{formatDate(order.proposedDate)}</strong>
                  </span>
                </div>
              )}
            </div>

            {order.notes && <p className="request-card__notes">"{order.notes}"</p>}

            {/* Payment (visible once the provider confirmed) */}
            {(() => {
              const payment = paymentByOrder.get(order.id);
              if (!payment || order.status === 'PENDING' || order.status === 'RESCHEDULE_PROPOSED') {
                return null;
              }
              const busy = payingId === payment.id;

              if (payment.status === 'PAID') {
                return (
                  <div className="pay-box pay-box--paid">
                    <CheckIcon size={15} />
                    <span>Pago completado — ${Number(payment.amount).toFixed(2)} {payment.currency.toUpperCase()}</span>
                  </div>
                );
              }
              if (payment.status === 'FAILED') {
                return (
                  <div className="pay-box pay-box--failed">
                    <AlertIcon size={15} />
                    <span>Pago rechazado{payment.failureReason ? ` — ${payment.failureReason}` : ''}</span>
                    <button
                      className="req-btn req-btn--accept pay-retry"
                      disabled={busy}
                      onClick={() => handlePay(payment, 'success')}
                    >
                      Reintentar
                    </button>
                  </div>
                );
              }
              // REQUIRES_PAYMENT
              return (
                <div className="pay-box pay-box--due">
                  <div className="pay-box__info">
                    <CreditCardIcon size={15} />
                    <span>Pago pendiente — ${Number(payment.amount).toFixed(2)} {payment.currency.toUpperCase()}</span>
                  </div>
                  <div className="pay-box__actions">
                    <button
                      className="req-btn req-btn--pay"
                      disabled={busy}
                      onClick={() => handlePay(payment, 'success')}
                    >
                      <CreditCardIcon size={14} /> {busy ? 'Procesando…' : 'Pagar ahora'}
                    </button>
                    <button
                      className="pay-fail-link"
                      disabled={busy}
                      onClick={() => handlePay(payment, 'fail')}
                      title="Simular un pago rechazado"
                    >
                      simular rechazo
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Footer: total + actions */}
            <div className="request-card__footer">
              <span className="request-card__total">
                ${Number(order.totalAmount).toFixed(2)}
              </span>

              {order.status === 'RESCHEDULE_PROPOSED' && (
                <div className="request-card__actions">
                  <button
                    className="req-btn req-btn--accept"
                    disabled={busy}
                    onClick={() => respondToProposal(order.id, 'CONFIRMED')}
                  >
                    <CheckIcon size={14} /> Aceptar nueva fecha
                  </button>
                  <button
                    className="req-btn req-btn--cancel"
                    disabled={busy}
                    onClick={() => respondToProposal(order.id, 'CANCELLED')}
                  >
                    <XIcon size={14} /> Cancelar
                  </button>
                </div>
              )}

              {order.status === 'PENDING' && (
                <button
                  className="req-btn req-btn--cancel"
                  disabled={busy}
                  onClick={() => respondToProposal(order.id, 'CANCELLED')}
                >
                  <XIcon size={14} /> Cancelar solicitud
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
