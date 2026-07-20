import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrderEntity } from './entities/order.entity';
import { KafkaProducerService } from '../kafka/kafka.producer.service';

/**
 * Exercises the order state machine — the most business-critical logic in
 * booking-service. Only the two external boundaries are faked (Postgres via
 * an in-memory repo, Kafka via a spy); the transition rules, ownership
 * checks and event payloads are the real service code.
 */

const CLIENT_ID = 'client-1';
const PROVIDER_ID = 'provider-1';
const OTHER_ID = 'stranger-1';

class InMemoryOrderRepo {
  rows: OrderEntity[] = [];

  create(data: Partial<OrderEntity>): OrderEntity {
    return Object.assign(new OrderEntity(), data);
  }

  async save(entity: OrderEntity): Promise<OrderEntity> {
    // Mimic TypeORM's @CreateDateColumn() — populated on first insert
    if (!entity.createdAt) entity.createdAt = new Date();
    const idx = this.rows.findIndex((r) => r.id === entity.id);
    if (idx >= 0) this.rows[idx] = entity;
    else this.rows.push(entity);
    return entity;
  }

  async findOne({ where }: { where: { id: string } }): Promise<OrderEntity | null> {
    return this.rows.find((r) => r.id === where.id) ?? null;
  }

  /**
   * Reproduce la semántica de TypeORM: un `where` objeto es un AND de sus
   * campos, y un `where` **array** es un OR entre condiciones.
   *
   * El array importa: `findAllForUser` lo usa para "órdenes donde soy cliente
   * O soy proveedor". Un fake que solo entendiera objetos devolvería siempre
   * lista vacía, y los tests de aislamiento pasarían por el motivo equivocado
   * — que es peor que fallar.
   */
  async find({
    where,
  }: {
    where: Partial<OrderEntity> | Partial<OrderEntity>[];
  }): Promise<OrderEntity[]> {
    const conditions = Array.isArray(where) ? where : [where];

    const matches = (row: OrderEntity, cond: Partial<OrderEntity>) =>
      Object.entries(cond).every(([k, v]) => row[k as keyof OrderEntity] === v);

    return this.rows.filter((row) => conditions.some((cond) => matches(row, cond)));
  }
}

async function makePendingOrder(service: OrdersService) {
  return service.createOrder(CLIENT_ID, {
    providerId: PROVIDER_ID,
    items: [{ serviceId: 'svc-1', quantity: 2, unitPrice: 75 }],
    scheduledDate: '2026-08-01T10:00:00.000Z',
  });
}

describe('OrdersService', () => {
  let service: OrdersService;
  let repo: InMemoryOrderRepo;
  let kafkaEmit: jest.Mock;

  beforeEach(async () => {
    repo = new InMemoryOrderRepo();
    kafkaEmit = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(OrderEntity), useValue: repo },
        { provide: KafkaProducerService, useValue: { emit: kafkaEmit } },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('createOrder', () => {
    it('computes totalAmount from items and starts PENDING', async () => {
      const order = await makePendingOrder(service);
      expect(order.status).toBe('PENDING');
      expect(order.totalAmount).toBe(150); // 2 × 75
    });

    it('emits order_created with the computed total', async () => {
      const order = await makePendingOrder(service);
      expect(kafkaEmit).toHaveBeenCalledWith(
        'order_created',
        order.id,
        expect.objectContaining({
          eventType: 'order_created',
          payload: expect.objectContaining({ status: 'PENDING', totalAmount: 150 }),
        }),
      );
    });

    it('still persists the order if the Kafka emit fails (order_created is best-effort)', async () => {
      kafkaEmit.mockRejectedValueOnce(new Error('broker down'));
      const order = await makePendingOrder(service);
      expect(repo.rows).toHaveLength(1);
      expect(order.status).toBe('PENDING');
    });
  });

  describe('updateStatus — transition rules', () => {
    it('rejects an unknown order with 404', async () => {
      await expect(
        service.updateStatus('missing-id', { status: 'CONFIRMED' }, PROVIDER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an actor who is neither the client nor the provider', async () => {
      const order = await makePendingOrder(service);
      await expect(
        service.updateStatus(order.id, { status: 'CONFIRMED' }, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a transition not allowed from the current state (PENDING → IN_PROGRESS)', async () => {
      const order = await makePendingOrder(service);
      await expect(
        service.updateStatus(order.id, { status: 'IN_PROGRESS' }, PROVIDER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a transition from a terminal state (CANCELLED → CONFIRMED)', async () => {
      const order = await makePendingOrder(service);
      await service.updateStatus(order.id, { status: 'CANCELLED' }, PROVIDER_ID);
      await expect(
        service.updateStatus(order.id, { status: 'CONFIRMED' }, PROVIDER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('PENDING → CONFIRMED is provider-only: the client is forbidden', async () => {
      const order = await makePendingOrder(service);
      await expect(
        service.updateStatus(order.id, { status: 'CONFIRMED' }, CLIENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('PENDING → CONFIRMED by the provider succeeds and emits order_confirmed', async () => {
      const order = await makePendingOrder(service);
      const updated = await service.updateStatus(order.id, { status: 'CONFIRMED' }, PROVIDER_ID);
      expect(updated.status).toBe('CONFIRMED');
      expect(kafkaEmit).toHaveBeenCalledWith(
        'order_confirmed',
        order.id,
        expect.objectContaining({
          eventType: 'order_confirmed',
          payload: expect.objectContaining({ status: 'CONFIRMED' }),
          metadata: expect.objectContaining({ previousStatus: 'PENDING', actorId: PROVIDER_ID }),
        }),
      );
    });

    it('CANCELLED is allowed to either party (client can cancel a PENDING order)', async () => {
      const order = await makePendingOrder(service);
      const updated = await service.updateStatus(order.id, { status: 'CANCELLED' }, CLIENT_ID);
      expect(updated.status).toBe('CANCELLED');
      expect(kafkaEmit).toHaveBeenCalledWith(
        'order_cancelled',
        order.id,
        expect.objectContaining({ eventType: 'order_cancelled' }),
      );
    });

    it('does not emit any Kafka event for transitions with no mapped topic (CONFIRMED → IN_PROGRESS)', async () => {
      const order = await makePendingOrder(service);
      await service.updateStatus(order.id, { status: 'CONFIRMED' }, PROVIDER_ID);
      kafkaEmit.mockClear();

      await service.updateStatus(order.id, { status: 'IN_PROGRESS' }, PROVIDER_ID);
      expect(kafkaEmit).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus — reschedule flow', () => {
    it('RESCHEDULE_PROPOSED without proposedDate is rejected', async () => {
      const order = await makePendingOrder(service);
      await expect(
        service.updateStatus(order.id, { status: 'RESCHEDULE_PROPOSED' }, PROVIDER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('RESCHEDULE_PROPOSED is provider-only', async () => {
      const order = await makePendingOrder(service);
      await expect(
        service.updateStatus(
          order.id,
          { status: 'RESCHEDULE_PROPOSED', proposedDate: '2026-08-05T10:00:00.000Z' },
          CLIENT_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('provider proposes a new date, then only the CLIENT can accept it', async () => {
      const order = await makePendingOrder(service);
      await service.updateStatus(
        order.id,
        { status: 'RESCHEDULE_PROPOSED', proposedDate: '2026-08-05T10:00:00.000Z' },
        PROVIDER_ID,
      );

      // Provider cannot accept their own proposal
      await expect(
        service.updateStatus(order.id, { status: 'CONFIRMED' }, PROVIDER_ID),
      ).rejects.toThrow(ForbiddenException);

      const accepted = await service.updateStatus(order.id, { status: 'CONFIRMED' }, CLIENT_ID);
      expect(accepted.status).toBe('CONFIRMED');
    });

    it('accepting a reschedule replaces scheduledDate with proposedDate and clears proposedDate', async () => {
      const order = await makePendingOrder(service);
      const originalDate = order.scheduledDate;

      await service.updateStatus(
        order.id,
        { status: 'RESCHEDULE_PROPOSED', proposedDate: '2026-08-05T10:00:00.000Z' },
        PROVIDER_ID,
      );
      const accepted = await service.updateStatus(order.id, { status: 'CONFIRMED' }, CLIENT_ID);

      expect(accepted.scheduledDate.toISOString()).toBe('2026-08-05T10:00:00.000Z');
      expect(accepted.scheduledDate).not.toEqual(originalDate);
      expect(accepted.proposedDate).toBeNull();
    });
  });

  describe('findAllForUser / findOne', () => {
    it('solo devuelve órdenes en las que el usuario participa', async () => {
      await makePendingOrder(service);
      const other = await service.createOrder('client-2', {
        providerId: 'provider-2',
        items: [{ serviceId: 'svc-2', quantity: 1, unitPrice: 50 }],
        scheduledDate: '2026-08-02T10:00:00.000Z',
      });

      const forClient1 = await service.findAllForUser(CLIENT_ID);
      expect(forClient1).toHaveLength(1);
      expect(forClient1[0].clientId).toBe(CLIENT_ID);

      const forProvider2 = await service.findAllForUser('provider-2');
      expect(forProvider2.map((o: { id: string }) => o.id)).toEqual([other.id]);
    });

    it('AISLAMIENTO: un usuario ajeno no ve nada, aunque conozca los UUID', async () => {
      // Esta es la regresión que cierra el IDOR demostrado: antes el filtro
      // llegaba por query param y bastaba con pasar el UUID de otra persona.
      await makePendingOrder(service);

      const intruso = await service.findAllForUser('usuario-sin-relacion');
      expect(intruso).toHaveLength(0);
    });

    it('el filtro por rol acota, pero nunca amplía a órdenes ajenas', async () => {
      await makePendingOrder(service); // CLIENT_ID como cliente

      expect(await service.findAllForUser(CLIENT_ID, { role: 'client' })).toHaveLength(1);
      // El mismo usuario, mirando como proveedor, no participa en ninguna.
      expect(await service.findAllForUser(CLIENT_ID, { role: 'provider' })).toHaveLength(0);
    });

    it('returns null for a missing order', async () => {
      expect(await service.findOne('missing-id')).toBeNull();
    });
  });
});
