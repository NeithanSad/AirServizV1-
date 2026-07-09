/** Canonical shape of a consumed Kafka event stored by the notification-service */
export interface NotificationRecord {
  id: string;

  // ── Consumer metadata ────────────────────────────────────────────────────
  consumer: string;          // 'notification-service'
  consumedAt: string;        // ISO-8601
  processingTimeMs: number;  // wall-clock time to process the message

  // ── Kafka metadata ───────────────────────────────────────────────────────
  eventType: string;         // 'order_created'
  topic: string;             // Kafka topic name
  partition: number;
  offset: string;

  // ── Business payload (from order_created event) ──────────────────────────
  orderId: string;
  clientId: string;
  providerId: string;
  itemCount: number;
  totalAmount: number;
  orderStatus: string;
  scheduledDate?: string; // agreed/requested service date (ISO-8601)
  proposedDate?: string;  // provider-proposed alternative date
  notes?: string;
}
