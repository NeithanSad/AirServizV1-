/**
 * Inbound Kafka event — emitted by booking-service when a provider confirms an
 * order. Mirrors booking-service's OrderConfirmedEvent (and libs/event-contracts).
 */
export interface OrderConfirmedEvent {
  eventType: 'order_confirmed';
  version: '1.0';
  payload: {
    id: string;
    clientId: string;
    providerId: string;
    totalAmount: number;
    status: 'CONFIRMED';
    scheduledDate?: string | null;
    proposedDate?: string | null;
    createdAt: string;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
    actorId: string;
    previousStatus: string;
  };
}
