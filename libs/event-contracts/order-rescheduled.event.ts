/** libs/event-contracts/order-rescheduled.event.ts */
export interface OrderRescheduledEvent {
  eventType: 'order_rescheduled';
  version: '1.0';
  payload: {
    id: string;
    clientId: string;
    providerId: string;
    totalAmount: number;
    status: 'RESCHEDULE_PROPOSED';
    scheduledDate: string | null; // date originally requested by the client
    proposedDate: string | null;  // new date proposed by the provider
    createdAt: string;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
    actorId: string;
    previousStatus: string;
  };
}
