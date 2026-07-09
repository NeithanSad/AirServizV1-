import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { NotificationsService } from '../notifications/notifications.service';

const TOPICS = [
  'order_created',
  'order_confirmed',
  'order_cancelled',
  'order_rescheduled',
  'payment_processed',
] as const;

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumer: Consumer;

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    const kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [this.config.get<string>('KAFKA_BROKER', 'localhost:29092')],
      retry: { retries: 8, initialRetryTime: 500 },
    });

    this.consumer = kafka.consumer({
      groupId: this.config.get<string>('KAFKA_GROUP_ID', 'notification-service-group'),
      // Commit only after processing — at-least-once delivery
      heartbeatInterval: 3000,
      sessionTimeout: 30000,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      this.logger.log('Kafka consumer connected');

      for (const topic of TOPICS) {
        await this.consumer.subscribe({ topic, fromBeginning: true });
        this.logger.log(`Subscribed to topic: "${topic}"`);
      }

      await this.consumer.run({ eachMessage: this.handleMessage.bind(this) });
      this.logger.log('Consumer loop running — waiting for events...');
    } catch (err) {
      this.logger.error(
        `Kafka consumer failed to start: ${(err as Error).message}. ` +
          'Ensure Kafka is running and restart.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.log('Kafka consumer disconnected');
  }

  private async handleMessage({
    topic,
    partition,
    message,
  }: EachMessagePayload): Promise<void> {
    const startMs = Date.now();

    if (!message.value) {
      this.logger.warn(`Empty message on topic "${topic}" — skipping`);
      return;
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(message.value.toString()) as Record<string, unknown>;
    } catch {
      this.logger.error(`Could not parse message on topic "${topic}" — skipping`);
      return;
    }

    this.notifications.record(event, {
      topic,
      partition,
      offset: message.offset,
      processingTimeMs: Date.now() - startMs,
    });
  }
}
