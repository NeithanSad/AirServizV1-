import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { PaymentsService } from './payments.service';
import { OrderConfirmedEvent } from './events/order-confirmed.event';

const TOPIC = 'order_confirmed';

@Injectable()
export class PaymentsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsConsumer.name);
  private readonly consumer: Consumer;

  constructor(
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
  ) {
    const kafka = new Kafka({
      clientId: 'payment-service',
      brokers: [this.config.get<string>('KAFKA_BROKER', 'localhost:29092')],
      retry: { retries: 8, initialRetryTime: 500 },
    });
    this.consumer = kafka.consumer({
      groupId: this.config.get<string>('KAFKA_GROUP_ID', 'payment-service-group'),
      heartbeatInterval: 3000,
      sessionTimeout: 30000,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: TOPIC, fromBeginning: true });
      await this.consumer.run({ eachMessage: this.handleMessage.bind(this) });
      this.logger.log(`Subscribed to "${TOPIC}" — waiting for confirmed orders...`);
    } catch (err) {
      this.logger.error(
        `Kafka consumer failed to start: ${(err as Error).message}. ` +
          'Ensure Kafka is running and restart.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    if (!message.value) {
      this.logger.warn(`Empty message on "${topic}" — skipping`);
      return;
    }

    let event: OrderConfirmedEvent;
    try {
      event = JSON.parse(message.value.toString()) as OrderConfirmedEvent;
    } catch {
      this.logger.error(`Could not parse message on "${topic}" — skipping`);
      return;
    }

    if (event.eventType !== 'order_confirmed' || !event.payload?.id) {
      this.logger.warn('Message is not a valid order_confirmed event — skipping');
      return;
    }

    try {
      await this.payments.handleOrderConfirmed(event);
    } catch (err) {
      // Do not rethrow — avoid poison-pill loops. Logged for investigation.
      this.logger.error(
        `Failed to process order_confirmed for order ${event.payload.id}: ${(err as Error).message}`,
      );
    }
  }
}
