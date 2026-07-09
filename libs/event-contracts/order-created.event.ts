/**
 * libs/event-contracts/order-created.event.ts
 *
 * Canonical event contract for the `order_created` Kafka topic.
 * Both producers (booking-service) and consumers (notification-service,
 * payment-service, etc.) MUST reference this interface.
 */
export interface OrderCreatedEvent {
  /** Discriminator – used by consumers to route event handling */
  eventType: 'order_created';
  /** Schema version – increment on breaking changes */
  version: '1.0';
  payload: {
    id: string;
    clientId: string;
    providerId: string;
    items: Array<{
      serviceId: string;
      quantity: number;
      unitPrice: number;
    }>;
    notes?: string;
    status: 'PENDING';
    totalAmount: number;
    createdAt: string; // ISO-8601
  };
  metadata: {
    timestamp: string;   // ISO-8601
    correlationId: string; // UUID v4 – trace across services
  };
}
