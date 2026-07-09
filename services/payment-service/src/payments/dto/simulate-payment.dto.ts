import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/**
 * Dev/demo helper: simulate the client completing (or failing) a payment.
 * In a real integration this is triggered by the provider's hosted checkout,
 * which then calls our webhook — here we build a signed webhook internally.
 */
export class SimulatePaymentDto {
  @ApiPropertyOptional({ enum: ['success', 'fail'], default: 'success' })
  @IsOptional()
  @IsIn(['success', 'fail'])
  outcome?: 'success' | 'fail';
}
