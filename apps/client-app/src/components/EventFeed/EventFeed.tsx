import { useEffect, useRef, useState } from 'react';
import './EventFeed.css';

// ── Types ────────────────────────────────────────────────────────────────────
interface NotificationRecord {
  id: string;
  consumer: string;
  consumedAt: string;
  processingTimeMs: number;
  eventType: string;
  topic: string;
  partition: number;
  offset: string;
  orderId: string;
  clientId: string;
  providerId: string;
  itemCount: number;
  totalAmount: number;
  orderStatus: string;
  notes?: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)  return 'ahora mismo';
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

function shortId(uuid: string): string {
  return uuid.slice(0, 8).toUpperCase();
}

// ── EventCard ────────────────────────────────────────────────────────────────
function EventCard({ n, now }: { n: NotificationRecord; now: number }) {
  void now; // used to force re-render for relative time
  return (
    <div className="event-card">
      {/* Top row: event badge + time */}
      <div className="event-card__top">
        <span className="event-card__event-badge">
          🔔 {n.eventType}
        </span>
        <span className="event-card__time">{relativeTime(n.consumedAt)}</span>
      </div>

      {/* Consumer row */}
      <div className="event-card__consumer">
        <span className="event-card__consumer-label">Consumidor:</span>
        <span className="event-card__consumer-name">{n.consumer}</span>
        <span className="event-card__consumer-action">consumió</span>
        <span className="event-card__topic">{n.topic}</span>
      </div>

      {/* Details grid */}
      <div className="event-card__details">
        <span className="event-card__detail-key">Order ID</span>
        <span className="event-card__detail-val" title={n.orderId}>#{shortId(n.orderId)}</span>

        <span className="event-card__detail-key">Cliente</span>
        <span className="event-card__detail-val" title={n.clientId}>{shortId(n.clientId)}</span>

        <span className="event-card__detail-key">Proveedor</span>
        <span className="event-card__detail-val" title={n.providerId}>{shortId(n.providerId)}</span>

        <span className="event-card__detail-key">Ítems</span>
        <span className="event-card__detail-val">{n.itemCount} ítem(s)</span>

        <span className="event-card__detail-key">Total</span>
        <span className="event-card__detail-val">${Number(n.totalAmount).toFixed(2)} USD</span>

        {n.notes && (
          <>
            <span className="event-card__detail-key">Notas</span>
            <span className="event-card__detail-val" title={n.notes}>{n.notes}</span>
          </>
        )}
      </div>

      {/* Footer: status + processing time */}
      <div className="event-card__footer">
        <span className={`event-card__status-badge status--${n.orderStatus}`}>
          {n.orderStatus}
        </span>
        <div className="event-card__perf">
          ⏱ procesado en <span>{n.processingTimeMs}ms</span>
        </div>
      </div>

      {/* Kafka metadata */}
      <div className="event-card__kafka-meta">
        partition={n.partition} · offset={n.offset}
      </div>
    </div>
  );
}

// ── EventFeed ────────────────────────────────────────────────────────────────
export default function EventFeed() {
  const [events, setEvents] = useState<NotificationRecord[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [now, setNow] = useState(Date.now());
  const esRef = useRef<EventSource | null>(null);

  // Tick every 15s to refresh relative timestamps
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Load existing history on mount
  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((body: { data: NotificationRecord[] }) => {
        if (Array.isArray(body.data)) setEvents(body.data);
      })
      .catch(() => {}); // silent — SSE will provide live data anyway
  }, []);

  // SSE connection
  useEffect(() => {
    function connect() {
      setStatus('connecting');
      const es = new EventSource('/api/notifications/stream');
      esRef.current = es;

      es.onopen = () => setStatus('connected');

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          const notification = JSON.parse(e.data) as NotificationRecord;
          setEvents((prev) => [notification, ...prev].slice(0, 200));
        } catch {
          // malformed message — ignore
        }
      };

      es.onerror = () => {
        setStatus('error');
        es.close();
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    }

    connect();
    return () => { esRef.current?.close(); };
  }, []);

  const statusLabel: Record<ConnectionStatus, string> = {
    connecting:   'Conectando...',
    connected:    'En vivo',
    disconnected: 'Desconectado',
    error:        'Reconectando...',
  };

  return (
    <div className="feed">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="feed__header">
        <div className="feed__title">
          📡 Event Feed
          {events.length > 0 && (
            <span className="feed__count">{events.length}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="feed__status">
            <div className={`feed__dot feed__dot--${status}`} />
            <span className={`feed__status-text--${status}`}>{statusLabel[status]}</span>
          </div>
          {events.length > 0 && (
            <button className="feed__clear" onClick={() => setEvents([])}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="feed__body">
        {events.length === 0 ? (
          <div className="feed__empty">
            <span className="feed__empty-icon">🕐</span>
            <strong>Sin eventos aún</strong>
            <span>
              Cuando el <code>notification-service</code> consuma un evento de Kafka,
              aparecerá aquí en tiempo real.
            </span>
            <span style={{ fontSize: '0.75rem' }}>
              Tópico escuchado: <code>order_created</code>
            </span>
          </div>
        ) : (
          events.map((n) => <EventCard key={n.id} n={n} now={now} />)
        )}
      </div>
    </div>
  );
}
