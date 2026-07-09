import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { NotificationRecord } from './notification.model';

const MAX_HISTORY = 200; // Keep last 200 notifications in memory

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly history: NotificationRecord[] = [];
  private readonly events$ = new Subject<MessageEvent>();

  /** Called by KafkaConsumerService for every consumed message */
  record(
    event: Record<string, unknown>,
    meta: { topic: string; partition: number; offset: string; processingTimeMs: number },
  ): NotificationRecord {
    const payload = (event['payload'] ?? {}) as Record<string, unknown>;

    const notification: NotificationRecord = {
      id: uuidv4(),
      // Consumer metadata
      consumer: 'notification-service',
      consumedAt: new Date().toISOString(),
      processingTimeMs: meta.processingTimeMs,
      // Kafka metadata
      eventType: String(event['eventType'] ?? 'unknown'),
      topic: meta.topic,
      partition: meta.partition,
      offset: meta.offset,
      // Business payload
      orderId: String(payload['id'] ?? ''),
      clientId: String(payload['clientId'] ?? ''),
      providerId: String(payload['providerId'] ?? ''),
      itemCount: Array.isArray(payload['items']) ? payload['items'].length : 0,
      totalAmount: Number(payload['totalAmount'] ?? 0),
      orderStatus: String(payload['status'] ?? 'UNKNOWN'),
      scheduledDate: payload['scheduledDate'] ? String(payload['scheduledDate']) : undefined,
      proposedDate: payload['proposedDate'] ? String(payload['proposedDate']) : undefined,
      notes: payload['notes'] ? String(payload['notes']) : undefined,
    };

    // Prepend (newest first) and cap history
    this.history.unshift(notification);
    if (this.history.length > MAX_HISTORY) this.history.pop();

    // Push to all SSE subscribers
    this.events$.next({ data: notification } as MessageEvent);

    this.logger.log(
      `[CONSUMED] topic=${meta.topic} | orderId=${notification.orderId} | ` +
        `total=$${notification.totalAmount.toFixed(2)} | ` +
        `partition=${meta.partition} | offset=${meta.offset} | ` +
        `⏱ ${meta.processingTimeMs}ms`,
    );

    return notification;
  }

  /** SSE stream — each subscriber gets future events */
  stream(): Observable<MessageEvent> {
    return this.events$.asObservable();
  }

  /** Full history (newest first) */
  findAll(): NotificationRecord[] {
    return this.history;
  }

  /** Clear history — dev/testing utility */
  clear(): void {
    this.history.length = 0;
    this.logger.warn('Notification history cleared');
  }
}
