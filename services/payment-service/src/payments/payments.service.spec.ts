import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentEntity } from './entities/payment.entity';
import { StripeSimulatedGateway } from './gateway/stripe-simulated.gateway';
import { PAYMENT_GATEWAY, GatewayEvent } from './gateway/payment-gateway.interface';
import { KafkaProducerService } from '../kafka/kafka.producer.service';
import { OrderConfirmedEvent } from './events/order-confirmed.event';

/**
 * Integration test of the webhook flow: real StripeSimulatedGateway (real
 * HMAC signing + verification), real PaymentsService logic. Only the two
 * external boundaries are faked: Postgres (in-memory repository) and Kafka
 * (spy). What we verify is the CORE payment invariant: processing the same
 * webhook twice must not apply the payment twice ("no duplicar el saldo") —
 * one state transition, one payment_processed emission.
 */

// ── In-memory stand-in for the TypeORM repository ────────────────────────────
class InMemoryPaymentRepo {
  rows: PaymentEntity[] = [];
  saveCalls = 0;

  async findOne({ where }: { where: Partial<PaymentEntity> }): Promise<PaymentEntity | null> {
    return (
      this.rows.find((r) =>
        Object.entries(where).every(([k, v]) => r[k as keyof PaymentEntity] === v),
      ) ?? null
    );
  }

  create(data: Partial<PaymentEntity>): PaymentEntity {
    return Object.assign(new PaymentEntity(), data);
  }

  async save(entity: PaymentEntity): Promise<PaymentEntity> {
    this.saveCalls++;
    if (!entity.id) {
      entity.id = `pay_${this.rows.length + 1}`;
      this.rows.push(entity);
    }
    return entity;
  }
}

const orderConfirmed = (orderId: string): OrderConfirmedEvent =>
  ({
    eventType: 'order_confirmed',
    version: '1.0',
    payload: {
      id: orderId,
      clientId: 'client-1',
      providerId: 'provider-1',
      totalAmount: 150,
    },
    metadata: { timestamp: new Date().toISOString(), correlationId: 'test' },
  }) as unknown as OrderConfirmedEvent;

/** Dummy signing key for tests — never a real one, but long enough to pass the
 *  gateway's minimum-length guard. */
const TEST_WEBHOOK_SECRET = 'whsec_test_0123456789abcdef0123456789abcdef';

describe('PaymentsService — webhook idempotency', () => {
  let service: PaymentsService;
  let gateway: StripeSimulatedGateway;
  let repo: InMemoryPaymentRepo;
  let kafkaEmit: jest.Mock;

  beforeEach(async () => {
    repo = new InMemoryPaymentRepo();
    kafkaEmit = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(PaymentEntity), useValue: repo },
        { provide: PAYMENT_GATEWAY, useClass: StripeSimulatedGateway },
        // StripeSimulatedGateway requires a real STRIPE_WEBHOOK_SECRET (>= 32
        // chars) and refuses to construct without one, so supply an explicit
        // test key rather than leaning on a default.
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'STRIPE_WEBHOOK_SECRET' ? TEST_WEBHOOK_SECRET : undefined),
          },
        },
        { provide: KafkaProducerService, useValue: { emit: kafkaEmit } },
      ],
    }).compile();

    service = module.get(PaymentsService);
    gateway = module.get(PAYMENT_GATEWAY);
  });

  /** Helper: create the payment intent and build its real signed webhook */
  async function createPaymentAndWebhook(outcome: 'succeeded' | 'payment_failed') {
    const payment = await service.handleOrderConfirmed(orderConfirmed('order-1'));
    const event: GatewayEvent = {
      id: 'evt_test_1',
      type: `payment_intent.${outcome}`,
      providerRef: payment.providerRef,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      currency: payment.currency,
      failureReason: outcome === 'payment_failed' ? 'Card declined' : undefined,
    };
    return { payment, ...gateway.buildSignedWebhook(event) };
  }

  it('processes a valid signed webhook: payment → PAID and emits payment_processed once', async () => {
    const { rawBody, signature } = await createPaymentAndWebhook('succeeded');

    const result = await service.processWebhook(rawBody, signature);

    expect(result.status).toBe('PAID');
    expect(kafkaEmit).toHaveBeenCalledTimes(1);
    expect(kafkaEmit).toHaveBeenCalledWith(
      'payment_processed',
      'order-1',
      expect.objectContaining({
        eventType: 'payment_processed',
        payload: expect.objectContaining({ orderId: 'order-1', status: 'PAID' }),
      }),
    );
  });

  it('IDEMPOTENCY: replaying the same webhook does not re-apply the payment nor re-emit the event', async () => {
    const { rawBody, signature } = await createPaymentAndWebhook('succeeded');

    const first = await service.processWebhook(rawBody, signature);
    const savesAfterFirst = repo.saveCalls;

    // Same signed payload delivered again (provider retry / duplicate delivery)
    const second = await service.processWebhook(rawBody, signature);

    expect(first.status).toBe('PAID');
    expect(second.status).toBe('PAID');
    expect(second.id).toBe(first.id);
    // No second state write and no second Kafka emission → downstream services
    // (booking, notification) never see the payment twice.
    expect(repo.saveCalls).toBe(savesAfterFirst);
    expect(kafkaEmit).toHaveBeenCalledTimes(1);
    // Still exactly one payment row for the order
    expect(repo.rows.filter((r) => r.orderId === 'order-1')).toHaveLength(1);
  });

  it('rejects a webhook whose signature does not match the body (tampered payload)', async () => {
    const { rawBody, signature } = await createPaymentAndWebhook('succeeded');
    const tampered = rawBody.replace('"amount":15000', '"amount":1');

    await expect(service.processWebhook(tampered, signature)).rejects.toThrow(
      BadRequestException,
    );
    // Nothing was applied
    expect(kafkaEmit).not.toHaveBeenCalled();
    expect(repo.rows[0].status).toBe('REQUIRES_PAYMENT');
  });

  it('IDEMPOTENCY: a replayed order_confirmed event does not create a second payment', async () => {
    const first = await service.handleOrderConfirmed(orderConfirmed('order-1'));
    const second = await service.handleOrderConfirmed(orderConfirmed('order-1'));

    expect(second.id).toBe(first.id);
    expect(repo.rows).toHaveLength(1);
  });
});

/**
 * The gateway used to default STRIPE_WEBHOOK_SECRET to a literal that was
 * committed to this repository. With the env var unset, webhook signatures
 * would then verify against a publicly-known key — enough to forge a
 * `payment_processed` event and settle an order for free. The constructor now
 * fails closed, and these tests keep it that way.
 */
describe('StripeSimulatedGateway — webhook secret is mandatory', () => {
  const gatewayWith = (secret: unknown) =>
    () =>
      new StripeSimulatedGateway({
        get: (key: string) => (key === 'STRIPE_WEBHOOK_SECRET' ? secret : undefined),
      } as unknown as ConfigService);

  it('refuses to construct when the secret is missing', () => {
    expect(gatewayWith(undefined)).toThrow(/STRIPE_WEBHOOK_SECRET is missing/);
  });

  it('refuses to construct when the secret is too short to be a real key', () => {
    expect(gatewayWith('whsec_sim_dev_secret')).toThrow(/shorter than 32 characters/);
  });

  it('constructs with a key of adequate length', () => {
    expect(gatewayWith(TEST_WEBHOOK_SECRET)).not.toThrow();
  });
});
