import { Module, Global } from '@nestjs/common';
import { KafkaProducerService } from './kafka.producer.service';

/**
 * @Global() makes KafkaProducerService available across the entire app.
 * The order_confirmed consumer lives in PaymentsModule (it needs
 * PaymentsService), so it is not declared here.
 */
@Global()
@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
