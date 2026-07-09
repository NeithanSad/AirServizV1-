/** Outbound Kafka event schema – mirrors libs/event-contracts */
export interface OrderCreatedEvent {
  eventType: 'order_created';
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
    status: string;
    totalAmount: number;
    scheduledDate: string | null; // date requested by the client (ISO-8601)
    createdAt: string; // ISO-8601
  };
  metadata: {
    timestamp: string;
    correlationId: string;
  };
}
