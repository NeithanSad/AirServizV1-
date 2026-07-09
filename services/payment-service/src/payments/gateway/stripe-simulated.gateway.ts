import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import {
  PaymentGateway,
  CreateIntentParams,
  PaymentIntent,
  GatewayEvent,
} from './payment-gateway.interface';

/**
 * Simulated Stripe gateway.
 *
 * Does NOT call any external API — but reproduces Stripe's real behaviours that
 * matter for the architecture: PaymentIntent ids/client secrets, a Stripe-style
 * event envelope, and HMAC webhook signatures (`t=...,v1=...`) so signature
 * verification is genuinely exercised. Replacing this with the real Stripe SDK
 * only requires implementing the same PaymentGateway interface.
 */
@Injectable()
export class StripeSimulatedGateway implements PaymentGateway {
  private readonly logger = new Logger(StripeSimulatedGateway.name);
  private readonly webhookSecret: string;
  private readonly toleranceSec = 300; // reject signatures older than 5 min

  constructor(private readonly config: ConfigService) {
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', 'whsec_sim_dev_secret');
  }

  async createPaymentIntent(params: CreateIntentParams): Promise<PaymentIntent> {
    const providerRef = `pi_sim_${randomBytes(12).toString('hex')}`;
    const clientSecret = `${providerRef}_secret_${randomBytes(8).toString('hex')}`;
    this.logger.log(
      `Created simulated PaymentIntent ${providerRef} for order ${params.orderId} ` +
        `(${params.amount} ${params.currency})`,
    );
    return { providerRef, clientSecret, status: 'requires_payment_method' };
  }

  buildSignedWebhook(event: GatewayEvent): { rawBody: string; signature: string } {
    const wireEvent = {
      id: event.id,
      type: event.type,
      data: {
        object: {
          id: event.providerRef,
          amount: Math.round(event.amount * 100), // Stripe uses minor units
          currency: event.currency,
          metadata: { orderId: event.orderId },
          last_payment_error: event.failureReason ? { message: event.failureReason } : null,
        },
      },
    };
    const rawBody = JSON.stringify(wireEvent);
    const signature = this.sign(rawBody);
    return { rawBody, signature };
  }

  verifyAndParseWebhook(rawBody: string, signatureHeader: string): GatewayEvent {
    this.verifySignature(rawBody, signatureHeader);

    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Webhook body is not valid JSON');
    }

    const obj = parsed?.data?.object;
    const orderId = obj?.metadata?.orderId;
    if (!parsed?.type || !obj?.id || !orderId) {
      throw new BadRequestException('Webhook payload is missing required fields');
    }
    if (parsed.type !== 'payment_intent.succeeded' && parsed.type !== 'payment_intent.payment_failed') {
      throw new BadRequestException(`Unsupported event type: ${parsed.type}`);
    }

    return {
      id: parsed.id,
      type: parsed.type,
      providerRef: obj.id,
      orderId,
      amount: Number(obj.amount ?? 0) / 100,
      currency: obj.currency ?? 'usd',
      failureReason: obj.last_payment_error?.message,
    };
  }

  // ── Stripe-style signature scheme ─────────────────────────────────────────
  private sign(rawBody: string, timestamp = Math.floor(Date.now() / 1000)): string {
    const signedPayload = `${timestamp}.${rawBody}`;
    const v1 = createHmac('sha256', this.webhookSecret).update(signedPayload).digest('hex');
    return `t=${timestamp},v1=${v1}`;
  }

  private verifySignature(rawBody: string, signatureHeader: string): void {
    if (!signatureHeader) {
      throw new BadRequestException('Missing webhook signature header');
    }

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((kv) => kv.split('=') as [string, string]),
    );
    const timestamp = Number(parts['t']);
    const provided = parts['v1'];
    if (!timestamp || !provided) {
      throw new BadRequestException('Malformed webhook signature header');
    }

    // Replay protection
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
    if (age > this.toleranceSec) {
      throw new BadRequestException('Webhook signature timestamp outside tolerance');
    }

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Webhook signature verification failed');
    }
  }
}
