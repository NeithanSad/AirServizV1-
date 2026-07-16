import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoParams } from './logging/pino.config';
import { ConfigModule } from '@nestjs/config';
import { KafkaConsumerModule } from './kafka/kafka-consumer.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // Logging estructurado (pino) — consola + Logstash/ELK si LOG_TCP_HOST
    LoggerModule.forRoot(buildPinoParams('notification-service')),
    NotificationsModule,
    KafkaConsumerModule,
    MetricsModule,
  ],
})
export class AppModule {}
