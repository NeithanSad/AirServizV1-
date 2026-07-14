import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOrders } from '@/services/adminApi';
import type { Order, OrderStatus } from '@/types/admin.types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  RESCHEDULED: 'Reprogramada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

const shortId = (uuid: string) => uuid.slice(0, 8);
const money = (n: string | number) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const dateFmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await getOrders());
    } catch {
      setError('No se pudieron cargar las órdenes (¿booking-service y Kong arriba?).');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (statusFilter === 'ALL' ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  );

  const totalVolume = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
    [orders],
  );
  const countBy = useCallback(
    (s: OrderStatus) => orders.filter((o) => o.status === s).length,
    [orders],
  );

  return (
    <section>
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-num">{orders.length}</span>
          <span className="stat-label">Transacciones</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{money(totalVolume)}</span>
          <span className="stat-label">Volumen total</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{countBy('CONFIRMED') + countBy('COMPLETED')}</span>
          <span className="stat-label">Confirmadas / completadas</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{countBy('PENDING')}</span>
          <span className="stat-label">Pendientes</span>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <h2>Órdenes</h2>
          <div className="toolbar-actions">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'ALL')}
            >
              <option value="ALL">Todos los estados</option>
              {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={load} disabled={loading}>
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <table>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Cliente</th>
              <th>Proveedor</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Fecha programada</th>
              <th>Creada</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>
                  <code>{shortId(o.id)}</code>
                </td>
                <td>
                  <code>{shortId(o.clientId)}</code>
                </td>
                <td>
                  <code>{shortId(o.providerId)}</code>
                </td>
                <td className="num">{money(o.totalAmount)}</td>
                <td>
                  <span className={`badge badge-${o.status.toLowerCase()}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </td>
                <td>{dateFmt(o.scheduledDate)}</td>
                <td>{dateFmt(o.createdAt)}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="muted centered-cell">
                  Sin órdenes para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
