import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '../kafka/kafka.producer.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto, AllowedTransition } from './dto/update-order-status.dto';
import { OrderCreatedEvent } from './events/order-created.event';
import {
  OrderConfirmedEvent,
  OrderCancelledEvent,
  OrderRescheduledEvent,
} from './events/order-status-changed.event';
import { OrderEntity } from './entities/order.entity';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULE_PROPOSED';

// Valid state machine transitions
const TRANSITIONS: Record<string, AllowedTransition[]> = {
  PENDING:              ['CONFIRMED', 'CANCELLED', 'RESCHEDULE_PROPOSED'],
  RESCHEDULE_PROPOSED:  ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:            ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:          ['COMPLETED', 'CANCELLED'],
};

// Transitions only the provider may perform. CANCELLED is allowed to both
// parties; RESCHEDULE_PROPOSED → CONFIRMED is the client accepting the new date.
const PROVIDER_ONLY: Array<`${string}->${AllowedTransition}`> = [
  'PENDING->CONFIRMED',
  'PENDING->RESCHEDULE_PROPOSED',
  'CONFIRMED->IN_PROGRESS',
  'IN_PROGRESS->COMPLETED',
];
const CLIENT_ONLY: Array<`${string}->${AllowedTransition}`> = [
  'RESCHEDULE_PROPOSED->CONFIRMED',
];

const TOPIC_MAP: Partial<Record<AllowedTransition, string>> = {
  CONFIRMED: 'order_confirmed',
  CANCELLED: 'order_cancelled',
  RESCHEDULE_PROPOSED: 'order_rescheduled',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  // ── Create ───────────────────────────────────────────────────────────────
  async createOrder(clientId: string, dto: CreateOrderDto): Promise<OrderEntity> {
    const orderId = uuidv4();
    const correlationId = uuidv4();
    const totalAmount =
      Math.round(
        dto.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100,
      ) / 100;

    const entity = this.repo.create({
      id: orderId,
      clientId,
      providerId: dto.providerId,
      items: dto.items,
      notes: dto.notes ?? '',
      status: 'PENDING',
      totalAmount,
      scheduledDate: new Date(dto.scheduledDate),
    });
    const saved = await this.repo.save(entity);

    const event: OrderCreatedEvent = {
      eventType: 'order_created',
      version: '1.0',
      payload: {
        id: saved.id,
        clientId: saved.clientId,
        providerId: saved.providerId,
        items: saved.items,
        notes: saved.notes || undefined,
        status: 'PENDING',
        totalAmount: saved.totalAmount,
        scheduledDate: saved.scheduledDate?.toISOString() ?? null,
        createdAt: saved.createdAt.toISOString(),
      },
      metadata: { timestamp: new Date().toISOString(), correlationId },
    };

    try {
      await this.kafkaProducer.emit('order_created', orderId, event);
    } catch (err) {
      this.logger.error(`Order ${orderId} saved but Kafka emit failed: ${(err as Error).message}`);
    }

    this.logger.log(`Order ${orderId} created — total $${totalAmount}`);
    return saved;
  }

  // ── Update status ─────────────────────────────────────────────────────────
  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    actorId: string,
  ): Promise<OrderEntity> {
    const order = await this.repo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const isProvider = order.providerId === actorId;
    const isClient = order.clientId === actorId;
    if (!isProvider && !isClient) {
      throw new ForbiddenException('Only the client or the assigned provider can update this order');
    }

    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} → ${dto.status}. Allowed: ${allowed.join(', ')}`,
      );
    }

    const transition = `${order.status}->${dto.status}` as `${string}->${AllowedTransition}`;
    if (PROVIDER_ONLY.includes(transition) && !isProvider) {
      throw new ForbiddenException(`Only the provider can perform ${transition}`);
    }
    if (CLIENT_ONLY.includes(transition) && !isClient) {
      throw new ForbiddenException(`Only the client can perform ${transition}`);
    }

    const previousStatus = order.status;

    if (dto.status === 'RESCHEDULE_PROPOSED') {
      if (!dto.proposedDate) {
        throw new BadRequestException('proposedDate is required when proposing a reschedule');
      }
      order.proposedDate = new Date(dto.proposedDate);
    }

    // Client accepts the provider's proposed date → it becomes the agreed date
    if (previousStatus === 'RESCHEDULE_PROPOSED' && dto.status === 'CONFIRMED') {
      if (order.proposedDate) order.scheduledDate = order.proposedDate;
      order.proposedDate = null as unknown as Date;
    }

    order.status = dto.status;
    const saved = await this.repo.save(order);

    const topic = TOPIC_MAP[dto.status];
    if (topic) {
      const payloadBase = {
        id: saved.id,
        clientId: saved.clientId,
        providerId: saved.providerId,
        totalAmount: Number(saved.totalAmount),
        scheduledDate: saved.scheduledDate?.toISOString() ?? null,
        proposedDate: saved.proposedDate?.toISOString() ?? null,
        createdAt: saved.createdAt.toISOString(),
      };
      const metadata = {
        timestamp: new Date().toISOString(),
        correlationId: uuidv4(),
        actorId,
        previousStatus,
      };

      let event: OrderConfirmedEvent | OrderCancelledEvent | OrderRescheduledEvent;
      switch (dto.status) {
        case 'CONFIRMED':
          event = {
            eventType: 'order_confirmed',
            version: '1.0',
            payload: { ...payloadBase, status: 'CONFIRMED' },
            metadata,
          };
          break;
        case 'RESCHEDULE_PROPOSED':
          event = {
            eventType: 'order_rescheduled',
            version: '1.0',
            payload: { ...payloadBase, status: 'RESCHEDULE_PROPOSED' },
            metadata,
          };
          break;
        default:
          event = {
            eventType: 'order_cancelled',
            version: '1.0',
            payload: { ...payloadBase, status: 'CANCELLED' },
            metadata,
          };
      }

      try {
        await this.kafkaProducer.emit(topic, orderId, event);
      } catch (err) {
        this.logger.error(`Status update saved but Kafka emit failed: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Order ${orderId}: ${previousStatus} → ${dto.status} by actor ${actorId}`);
    return saved;
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  /**
   * Órdenes en las que participa `userId`, como cliente o como proveedor.
   *
   * Antes este método aceptaba `clientId`/`providerId` sueltos desde los query
   * params, sin comprobar que correspondieran a quien preguntaba: cualquier
   * usuario autenticado podía listar las órdenes de otro pasando su UUID. El
   * filtro ya no se acepta desde fuera, se deriva del token.
   */
  findAllForUser(
    userId: string,
    opts: { role?: 'client' | 'provider' } = {},
  ): Promise<OrderEntity[]> {
    // Sin `role`, se devuelven ambas caras: un mismo usuario puede ser cliente
    // en unas órdenes y proveedor en otras.
    const where =
      opts.role === 'client'
        ? [{ clientId: userId }]
        : opts.role === 'provider'
          ? [{ providerId: userId }]
          : [{ clientId: userId }, { providerId: userId }];

    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  /** Solo para uso interno/administrativo. Nunca desde una ruta de usuario. */
  findAllUnscoped(filters: { providerId?: string; clientId?: string }): Promise<OrderEntity[]> {
    return this.repo.find({
      where: {
        ...(filters.providerId && { providerId: filters.providerId }),
        ...(filters.clientId && { clientId: filters.clientId }),
      },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string): Promise<OrderEntity | null> {
    return this.repo.findOne({ where: { id } });
  }
}
