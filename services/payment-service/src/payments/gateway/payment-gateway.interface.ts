/**
 * Abstraction over the payment provider (Stripe, MercadoPago, …).
 *
 * The rest of the service depends only on this interface, so the simulated
 * gateway used for the integrator project can be swapped for the real Stripe
 * SDK by providing a different implementation — no changes to PaymentsService.
 */

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CreateIntentParams {
  orderId: string;
  amount: number; // in major units (e.g. dollars)
  currency: string; // ISO 4217, lowercase (e.g. 'usd')
}

export interface PaymentIntent {
  providerRef: string; // e.g. Stripe PaymentIntent id (pi_...)
  clientSecret: string; // returned to the client to complete payment
  status: 'requires_payment_method';
}

/** Normalized provider webhook event (mirrors Stripe's event envelope) */
export interface GatewayEvent {
  id: string; // event id (evt_...)
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed';
  providerRef: string; // the PaymentIntent id this event refers to
  orderId: string;
  amount: number;
  currency: string;
  failureReason?: string;
}

export interface PaymentGateway {
  /** Creates a provider-side payment intent for a confirmed order */
  createPaymentIntent(params: CreateIntentParams): Promise<PaymentIntent>;

  /**
   * Builds a signed webhook payload simulating the provider calling back.
   * Used by the /pay simulation endpoint to exercise the real webhook path.
   */
  buildSignedWebhook(event: GatewayEvent): { rawBody: string; signature: string };

  /**
   * Verifies a webhook signature (Stripe `t=...,v1=...` scheme) and returns
   * the parsed event, or throws if the signature is invalid.
   */
  verifyAndParseWebhook(rawBody: string, signatureHeader: string): GatewayEvent;
}
