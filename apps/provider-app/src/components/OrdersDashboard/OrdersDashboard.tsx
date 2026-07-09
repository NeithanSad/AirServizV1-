import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getOrders, updateOrderStatus } from '@/services/ordersApi';
import type { Order, OrderStatus } from '@/types/order.types';
import {
  ClockIcon,
  CheckIcon,
  CheckCircleIcon,
  XIcon,
  RefreshIcon,
  PlayIcon,
  ArchiveIcon,
  CalendarIcon,
  InboxIcon,
  BellIcon,
} from '@/components/Icons';
import './OrdersDashboard.css';

type Tab = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE';

const TAB_LABELS: Record<Tab, string> = {
  PENDING:     'Pendientes',
  CONFIRMED:   'Confirmadas',
  IN_PROGRESS: 'En progreso',
  DONE:        'Finalizadas',
};

const TAB_ICONS: Record<Tab, JSX.Element> = {
  PENDING:     <ClockIcon size={14} />,
  CONFIRMED:   <CheckCircleIcon size={14} />,
  IN_PROGRESS: <PlayIcon size={14} />,
  DONE:        <ArchiveIcon size={14} />,
};

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const REFRESH_INTERVAL = 10_000; // 10 seconds

/** datetime-local needs "YYYY-MM-DDTHH:mm" in local time */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function OrdersDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('PENDING');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // orderId whose reschedule date-picker is open, and its value
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const esRef = useRef<EventSource | null>(null);

  // ── Toast helper ──────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Fetch orders ──────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const data = await getOrders(user.id);
      setOrders(data);
    } catch {
      if (!silent) showToast('Error al cargar órdenes', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // ── Live notifications (SSE from notification-service) ────────────────
  useEffect(() => {
    if (!user) return;
    const es = new EventSource('/api/notifications/stream');
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const n = JSON.parse(e.data) as { eventType: string; providerId: string; clientId: string };
        if (n.providerId !== user.id) return; // only events for this provider
        if (n.eventType === 'order_created') {
          showToast('Nueva solicitud de servicio recibida', 'info');
          fetchOrders(true);
        } else if (n.eventType === 'order_confirmed' || n.eventType === 'order_cancelled') {
          // client responded to a proposal / cancelled
          fetchOrders(true);
        }
      } catch {
        // malformed event — ignore
      }
    };

    return () => { es.close(); };
  }, [user, fetchOrders, showToast]);

  // ── Update order status ───────────────────────────────────────────────
  async function handleStatusChange(orderId: string, newStatus: OrderStatus, proposedDate?: string) {
    setActionLoading(orderId);
    try {
      const updated = await updateOrderStatus(orderId, newStatus, proposedDate);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      const labels: Record<string, string> = {
        CONFIRMED: 'Orden confirmada',
        CANCELLED: 'Orden rechazada',
        IN_PROGRESS: 'Orden iniciada',
        COMPLETED: 'Orden completada',
        RESCHEDULE_PROPOSED: 'Nueva fecha propuesta al cliente',
      };
      showToast(labels[newStatus] ?? `Estado: ${newStatus}`, 'success');
      setRescheduling(null);
    } catch {
      showToast('Error al actualizar estado', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function openReschedule(order: Order) {
    const base = order.scheduledDate ? new Date(order.scheduledDate) : new Date();
    base.setDate(base.getDate() + 1);
    setRescheduleDate(toLocalInputValue(base));
    setRescheduling(order.id);
  }

  // ── Filter orders by tab ──────────────────────────────────────────────
  function filterByTab(tab: Tab): Order[] {
    switch (tab) {
      case 'PENDING':
        // Awaiting resolution: new requests + proposals pending client response
        return orders.filter(o => o.status === 'PENDING' || o.status === 'RESCHEDULE_PROPOSED');
      case 'DONE':
        return orders.filter(o => o.status === 'COMPLETED' || o.status === 'CANCELLED');
      default:
        return orders.filter(o => o.status === tab);
    }
  }

  const filtered = filterByTab(activeTab);

  function countForTab(tab: Tab): number {
    return filterByTab(tab).length;
  }

  // ── Format date ───────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tabs */}
      <div className="od-tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
          <button
            key={tab}
            className={`od-tab ${activeTab === tab ? 'od-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_ICONS[tab]} {TAB_LABELS[tab]}
            <span className="od-tab-count">{countForTab(tab)}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="od-toolbar">
        <div className="od-auto-label">
          <span className="od-auto-dot" />
          Actualización automática y notificaciones en vivo
        </div>
        <button
          className="od-refresh-btn"
          onClick={() => fetchOrders()}
          disabled={loading}
        >
          <RefreshIcon size={13} className="od-refresh-icon" />
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && orders.length === 0 && (
        <div className="od-skeleton">
          {[1, 2, 3].map(i => <div key={i} className="od-skeleton-card" />)}
        </div>
      )}

      {/* Orders grid */}
      {!loading || orders.length > 0 ? (
        <div className="od-grid">
          {filtered.length === 0 && (
            <div className="od-empty">
              <div className="od-empty-icon"><InboxIcon size={36} /></div>
              No hay órdenes en esta categoría
            </div>
          )}

          {filtered.map(order => (
            <div className="od-card" key={order.id}>
              {/* Header */}
              <div className="od-card-header">
                <span className="od-order-id">#{order.id.slice(0, 8)}</span>
                <span className={`od-badge od-badge--${order.status}`}>
                  {order.status === 'RESCHEDULE_PROPOSED'
                    ? 'FECHA PROPUESTA'
                    : order.status.replace('_', ' ')}
                </span>
              </div>

              {/* Body */}
              <div className="od-card-body">
                <div className="od-row">
                  <span className="od-row-label">Cliente</span>
                  <span className="od-row-value" style={{ fontFamily: 'Consolas, monospace', fontSize: '0.76rem' }}>
                    {order.clientId.slice(0, 8)}…
                  </span>
                </div>
                {order.scheduledDate && (
                  <div className="od-row">
                    <span className="od-row-label">Fecha solicitada</span>
                    <span className="od-row-value od-row-value--date">
                      <CalendarIcon size={13} /> {formatDate(order.scheduledDate)}
                    </span>
                  </div>
                )}
                {order.status === 'RESCHEDULE_PROPOSED' && order.proposedDate && (
                  <div className="od-row">
                    <span className="od-row-label">Propusiste</span>
                    <span className="od-row-value od-row-value--proposed">
                      <ClockIcon size={13} /> {formatDate(order.proposedDate)}
                    </span>
                  </div>
                )}
                <div className="od-row">
                  <span className="od-row-label">Creada</span>
                  <span className="od-row-value">{formatDate(order.createdAt)}</span>
                </div>
                <div className="od-row">
                  <span className="od-row-label">Total</span>
                  <span className="od-amount">${Number(order.totalAmount).toFixed(2)}</span>
                </div>
              </div>

              {/* Items */}
              {order.items.length > 0 && (
                <div className="od-items">
                  {order.items.map((item, idx) => (
                    <div className="od-item" key={idx}>
                      <span className="od-item-name">{item.serviceId.slice(0, 8)}…</span>
                      <span className="od-item-detail">
                        {item.quantity} × ${item.unitPrice.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {order.notes && <div className="od-notes">"{order.notes}"</div>}

              <hr className="od-divider" />

              {/* Reschedule date picker */}
              {rescheduling === order.id ? (
                <div className="od-reschedule">
                  <label className="od-reschedule-label" htmlFor={`resched-${order.id}`}>
                    Nueva fecha propuesta
                  </label>
                  <input
                    id={`resched-${order.id}`}
                    type="datetime-local"
                    className="od-reschedule-input"
                    value={rescheduleDate}
                    min={toLocalInputValue(new Date())}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                  <div className="od-actions">
                    <button
                      className="od-btn od-btn--confirm"
                      disabled={actionLoading === order.id || !rescheduleDate}
                      onClick={() =>
                        handleStatusChange(
                          order.id,
                          'RESCHEDULE_PROPOSED',
                          new Date(rescheduleDate).toISOString(),
                        )
                      }
                    >
                      <CheckIcon size={13} /> Enviar propuesta
                    </button>
                    <button
                      className="od-btn od-btn--neutral"
                      disabled={actionLoading === order.id}
                      onClick={() => setRescheduling(null)}
                    >
                      <XIcon size={13} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="od-actions">
                  {order.status === 'PENDING' && (
                    <>
                      <button
                        className="od-btn od-btn--confirm"
                        disabled={actionLoading === order.id}
                        onClick={() => handleStatusChange(order.id, 'CONFIRMED')}
                      >
                        <CheckIcon size={13} /> Confirmar
                      </button>
                      <button
                        className="od-btn od-btn--reschedule"
                        disabled={actionLoading === order.id}
                        onClick={() => openReschedule(order)}
                      >
                        <CalendarIcon size={13} /> Otra fecha
                      </button>
                      <button
                        className="od-btn od-btn--reject"
                        disabled={actionLoading === order.id}
                        onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                      >
                        <XIcon size={13} /> Rechazar
                      </button>
                    </>
                  )}
                  {order.status === 'RESCHEDULE_PROPOSED' && (
                    <span className="od-waiting">
                      <BellIcon size={13} /> Esperando respuesta del cliente…
                    </span>
                  )}
                  {order.status === 'CONFIRMED' && (
                    <button
                      className="od-btn od-btn--start"
                      disabled={actionLoading === order.id}
                      onClick={() => handleStatusChange(order.id, 'IN_PROGRESS')}
                    >
                      <PlayIcon size={13} /> Iniciar servicio
                    </button>
                  )}
                  {order.status === 'IN_PROGRESS' && (
                    <button
                      className="od-btn od-btn--complete"
                      disabled={actionLoading === order.id}
                      onClick={() => handleStatusChange(order.id, 'COMPLETED')}
                    >
                      <CheckCircleIcon size={13} /> Completar
                    </button>
                  )}
                  {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                    <span className="od-final-state">
                      {order.status === 'COMPLETED'
                        ? <><CheckCircleIcon size={13} /> Servicio finalizado</>
                        : <><XIcon size={13} /> Orden cancelada</>}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Toasts */}
      {toasts.map((toast, i) => (
        <div
          key={toast.id}
          className={`od-toast od-toast--${toast.type}`}
          style={{ bottom: `${1.5 + i * 3.4}rem` }}
        >
          {toast.type === 'success' && <CheckIcon size={14} />}
          {toast.type === 'error' && <XIcon size={14} />}
          {toast.type === 'info' && <BellIcon size={14} />}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
