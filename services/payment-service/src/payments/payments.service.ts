import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerService } from '../kafka/kafka.producer.service';
import { PaymentEntity } from './entities/payment.entity';
import { OrderConfirmedEvent } from './events/order-confirmed.event';
import { PaymentProcessedEvent } from './events/payment-processed.event';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
  GatewayEvent,
} from './gateway/payment-gateway.interface';

const GATEWAY_NAME = 'stripe-simulated';
const PAYMENT_PROCESSED_TOPIC = 'payment_processed';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repo: Repository<PaymentEntity>,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    // Optional so unit tests can omit Kafka
    @Optional() private readonly kafka?: KafkaProducerService,
  ) {}

  // ── Inbound: order_confirmed → create a payment intent ────────────────────
  async handleOrderConfirmed(event: OrderConfirmedEvent): Promise<PaymentEntity> {
    const { id: orderId, clientId, providerId, totalAmount } = event.payload;

    // Idempotency: at-least-once Kafka delivery may replay this event
    const existing = await this.repo.findOne({ where: { orderId } });
    if (existing) {
      this.logger.log(`Payment already exists for order ${orderId} — skipping (idempotent)`);
      return existing;
    }

    const intent = await this.gateway.createPaymentIntent({
      orderId,
      amount: Number(totalAmount),
      currency: 'usd',
    });

    const payment = this.repo.create({
      orderId,
      clientId,
      providerId,
      amount: Number(totalAmount),
      currency: 'usd',
      status: 'REQUIRES_PAYMENT',
      gateway: GATEWAY_NAME,
      providerRef: intent.providerRef,
      clientSecret: intent.clientSecret,
    });
    const saved = await this.repo.save(payment);
    this.logger.log(
      `Payment ${saved.id} created for order ${orderId} — $${saved.amount} (REQUIRES_PAYMENT)`,
    );
    return saved;
  }

  // ── Webhook entry: verify signature, then process ─────────────────────────
  async processWebhook(rawBody: string, signature: string): Promise<PaymentEntity> {
    const event = this.gateway.verifyAndParseWebhook(rawBody, signature);
    this.logger.log(`Verified webhook ${event.id} (${event.type}) for order ${event.orderId}`);
    return this.applyGatewayEvent(event);
  }

  // ── Demo helper: simulate the client paying through the signed webhook ────
  async simulateClientPayment(
    paymentId: string,
    outcome: 'success' | 'fail',
  ): Promise<PaymentEntity> {
    const payment = await this.repo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

    const event: GatewayEvent = {
      id: `evt_sim_${uuidv4()}`,
      type: outcome === 'success' ? 'payment_intent.succeeded' : 'payment_intent.payment_failed',
      providerRef: payment.providerRef,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      currency: payment.currency,
      failureReason: outcome === 'fail' ? 'Card declined (simulated)' : undefined,
    };

    // Route through the real webhook path so signature verification runs
    const { rawBody, signature } = this.gateway.buildSignedWebhook(event);
    return this.processWebhook(rawBody, signature);
  }

  // ── Core: apply a verified gateway event to the payment ───────────────────
  private async applyGatewayEvent(event: GatewayEvent): Promise<PaymentEntity> {
    const payment = await this.repo.findOne({ where: { orderId: event.orderId } });
    if (!payment) {
      throw new NotFoundException(`No payment found for order ${event.orderId}`);
    }

    // Idempotency: ignore duplicate webhooks once terminal
    if (payment.status === 'PAID' || payment.status === 'FAILED') {
      this.logger.log(
        `Payment ${payment.id} already ${payment.status} — ignoring duplicate webhook (idempotent)`,
      );
      return payment;
    }

    payment.status = event.type === 'payment_intent.succeeded' ? 'PAID' : 'FAILED';
    payment.failureReason = event.failureReason ?? null;
    const saved = await this.repo.save(payment);
    this.logger.log(`Payment ${saved.id} → ${saved.status} for order ${saved.orderId}`);

    await this.emitPaymentProcessed(saved);
    return saved;
  }

  private async emitPaymentProcessed(payment: PaymentEntity): Promise<void> {
    const event: PaymentProcessedEvent = {
      eventType: 'payment_processed',
      version: '1.0',
      payload: {
        id: payment.orderId,
        orderId: payment.orderId,
        paymentId: payment.id,
        clientId: payment.clientId,
        providerId: payment.providerId,
        totalAmount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status === 'PAID' ? 'PAID' : 'FAILED',
        failureReason: payment.failureReason ?? undefined,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId: uuidv4(),
        gateway: payment.gateway,
        providerRef: payment.providerRef,
      },
    };

    try {
      await this.kafka?.emit(PAYMENT_PROCESSED_TOPIC, payment.orderId, event);
    } catch (err) {
      this.logger.error(
        `Payment ${payment.id} saved but payment_processed emit failed: ${(err as Error).message}`,
      );
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  findAll(clientId?: string): Promise<PaymentEntity[]> {
    return this.repo.find({
      where: clientId ? { clientId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async findByOrder(orderId: string): Promise<PaymentEntity> {
    const payment = await this.repo.findOne({ where: { orderId } });
    if (!payment) throw new NotFoundException(`No payment found for order ${orderId}`);
    return payment;
  }
}
