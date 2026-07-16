import { firstValueFrom, take, toArray } from 'rxjs';
import { NotificationsService } from './notifications.service';

const meta = (overrides: Partial<{ topic: string; partition: number; offset: string }> = {}) => ({
  topic: 'order_created',
  partition: 0,
  offset: '0',
  processingTimeMs: 5,
  ...overrides,
});

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(() => {
    service = new NotificationsService();
  });

  describe('record — event → NotificationRecord mapping', () => {
    it('maps the event payload fields into the notification record', () => {
      const notification = service.record(
        {
          eventType: 'order_created',
          payload: {
            id: 'order-1',
            clientId: 'client-1',
            providerId: 'provider-1',
            items: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }],
            totalAmount: 150,
            status: 'PENDING',
            scheduledDate: '2026-08-01T10:00:00.000Z',
          },
        },
        meta(),
      );

      expect(notification.eventType).toBe('order_created');
      expect(notification.orderId).toBe('order-1');
      expect(notification.clientId).toBe('client-1');
      expect(notification.itemCount).toBe(2);
      expect(notification.totalAmount).toBe(150);
      expect(notification.orderStatus).toBe('PENDING');
      expect(notification.scheduledDate).toBe('2026-08-01T10:00:00.000Z');
    });

    it('defaults gracefully when the payload is missing fields (does not throw)', () => {
      const notification = service.record({ eventType: 'payment_processed' }, meta());
      expect(notification.orderId).toBe('');
      expect(notification.totalAmount).toBe(0);
      expect(notification.orderStatus).toBe('UNKNOWN');
      expect(notification.itemCount).toBe(0);
    });

    it('carries the Kafka delivery metadata (topic/partition/offset)', () => {
      const notification = service.record(
        { eventType: 'order_confirmed', payload: {} },
        meta({ topic: 'order_confirmed', partition: 2, offset: '17' }),
      );
      expect(notification.topic).toBe('order_confirmed');
      expect(notification.partition).toBe(2);
      expect(notification.offset).toBe('17');
    });

    it('assigns a unique id to every notification', () => {
      const a = service.record({ eventType: 'order_created', payload: {} }, meta());
      const b = service.record({ eventType: 'order_created', payload: {} }, meta());
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('history', () => {
    it('findAll returns notifications newest-first', () => {
      service.record({ eventType: 'order_created', payload: { id: 'first' } }, meta());
      service.record({ eventType: 'order_created', payload: { id: 'second' } }, meta());

      const all = service.findAll();
      expect(all[0].orderId).toBe('second');
      expect(all[1].orderId).toBe('first');
    });

    it('caps history at 200 entries, dropping the oldest', () => {
      for (let i = 0; i < 205; i++) {
        service.record({ eventType: 'order_created', payload: { id: `order-${i}` } }, meta());
      }
      const all = service.findAll();
      expect(all).toHaveLength(200);
      expect(all[0].orderId).toBe('order-204'); // newest survives
      expect(all[all.length - 1].orderId).toBe('order-5'); // orders 0-4 were evicted
    });

    it('clear empties the history', () => {
      service.record({ eventType: 'order_created', payload: {} }, meta());
      service.clear();
      expect(service.findAll()).toHaveLength(0);
    });
  });

  describe('stream — SSE broadcast', () => {
    it('emits a MessageEvent for every recorded notification, in order', async () => {
      const received = firstValueFrom(service.stream().pipe(take(2), toArray()));

      const first = service.record({ eventType: 'order_created', payload: { id: 'a' } }, meta());
      const second = service.record({ eventType: 'order_created', payload: { id: 'b' } }, meta());

      const events = await received;
      expect((events[0].data as any).id).toBe(first.id);
      expect((events[1].data as any).id).toBe(second.id);
    });

    it('a late subscriber does not receive notifications recorded before it subscribed', async () => {
      service.record({ eventType: 'order_created', payload: { id: 'missed' } }, meta());

      const received = firstValueFrom(service.stream().pipe(take(1), toArray()));
      const after = service.record({ eventType: 'order_created', payload: { id: 'seen' } }, meta());

      const events = await received;
      expect((events[0].data as any).id).toBe(after.id);
    });
  });
});
