import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, CompressionTypes } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: Producer;
  private connected = false;

  constructor(private readonly config: ConfigService) {
    const broker = this.config.get<string>('KAFKA_BROKER', 'localhost:29092');
    const kafka = new Kafka({
      clientId: 'payment-service',
      brokers: [broker],
      retry: { retries: 3, initialRetryTime: 300, maxRetryTime: 3000 },
    });
    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log('Kafka producer connected');
    } catch (err) {
      this.logger.warn(
        `Kafka unavailable at startup — producer not connected. ` +
          `Start Kafka and restart the service. Error: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    }
  }

  /**
   * Emits a single event to a Kafka topic.
   * Throws ServiceUnavailableException (503) if Kafka is not connected.
   */
  async emit(topic: string, key: string, value: object): Promise<void> {
    if (!this.connected) {
      throw new ServiceUnavailableException(
        'Kafka producer is not connected. Ensure Kafka is running.',
      );
    }
    await this.producer.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key,
          value: JSON.stringify(value),
          headers: {
            'content-type': 'application/json',
            source: 'payment-service',
          },
        },
      ],
    });
    this.logger.log(`[Kafka] → topic="${topic}" key="${key}"`);
  }
}
