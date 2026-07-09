/** Shared payload fields for order status-change events */
interface StatusChangePayloadBase {
  id: string;
  clientId: string;
  providerId: string;
  totalAmount: number;
  scheduledDate: string | null; // agreed/requested service date (ISO-8601)
  proposedDate: string | null;  // provider-proposed alternative date
  createdAt: string;
}

interface StatusChangeMetadata {
  timestamp: string;
  correlationId: string;
  actorId: string; // user that performed the transition
  previousStatus: string;
}

/** Outbound Kafka event — emitted when a provider confirms an order */
export interface OrderConfirmedEvent {
  eventType: 'order_confirmed';
  version: '1.0';
  payload: StatusChangePayloadBase & { status: 'CONFIRMED' };
  metadata: StatusChangeMetadata;
}

/** Outbound Kafka event — emitted when an order is cancelled */
export interface OrderCancelledEvent {
  eventType: 'order_cancelled';
  version: '1.0';
  payload: StatusChangePayloadBase & { status: 'CANCELLED' };
  metadata: StatusChangeMetadata;
}

/** Outbound Kafka event — emitted when a provider proposes a new date */
export interface OrderRescheduledEvent {
  eventType: 'order_rescheduled';
  version: '1.0';
  payload: StatusChangePayloadBase & { status: 'RESCHEDULE_PROPOSED' };
  metadata: StatusChangeMetadata;
}
