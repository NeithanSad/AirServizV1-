/** libs/event-contracts/order-cancelled.event.ts */
export interface OrderCancelledEvent {
  eventType: 'order_cancelled';
  version: '1.0';
  payload: {
    id: string;
    clientId: string;
    providerId: string;
    totalAmount: number;
    status: 'CANCELLED';
    createdAt: string;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
    actorId: string;
    previousStatus: string;
  };
}
