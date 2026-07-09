/**
 * Outbound Kafka event — emitted after a payment reaches a terminal state.
 *
 * The payload intentionally reuses `id` (= orderId), `clientId`, `providerId`,
 * `totalAmount` and `status` so notification-service can record it with its
 * existing generic extractor. Payment-specific fields are added alongside.
 */
export interface PaymentProcessedEvent {
  eventType: 'payment_processed';
  version: '1.0';
  payload: {
    id: string; // orderId — keeps the notification feed keyed by order
    orderId: string;
    paymentId: string;
    clientId: string;
    providerId: string;
    totalAmount: number; // the amount charged
    currency: string;
    status: 'PAID' | 'FAILED';
    failureReason?: string;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
    gateway: string;
    providerRef: string;
  };
}
