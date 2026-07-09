/** libs/event-contracts/payment-processed.event.ts */
export interface PaymentProcessedEvent {
  eventType: 'payment_processed';
  version: '1.0';
  payload: {
    id: string; // orderId — keeps the notification feed keyed by order
    orderId: string;
    paymentId: string;
    clientId: string;
    providerId: string;
    totalAmount: number;
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
