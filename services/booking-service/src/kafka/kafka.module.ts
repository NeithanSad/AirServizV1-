import { Module, Global } from '@nestjs/common';
import { KafkaProducerService } from './kafka.producer.service';

/**
 * @Global() makes KafkaProducerService available across the entire app
 * without re-importing KafkaModule in each feature module.
 */
@Global()
@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
