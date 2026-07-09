/** libs/event-contracts/order-confirmed.event.ts */
export interface OrderConfirmedEvent {
  eventType: 'order_confirmed';
  version: '1.0';
  payload: {
    id: string;
    clientId: string;
    providerId: string;
    totalAmount: number;
    status: 'CONFIRMED';
    createdAt: string;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
    actorId: string;
    previousStatus: string;
  };
}
