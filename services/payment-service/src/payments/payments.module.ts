import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsConsumer } from './payments.consumer';
import { StripeSimulatedGateway } from './gateway/stripe-simulated.gateway';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway.interface';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity])],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsConsumer,
    // Bind the gateway interface to the simulated Stripe implementation.
    // Swap this line for a real StripeGateway to go live.
    { provide: PAYMENT_GATEWAY, useClass: StripeSimulatedGateway },
  ],
})
export class PaymentsModule {}
