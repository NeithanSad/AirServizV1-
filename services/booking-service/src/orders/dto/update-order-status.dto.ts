import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type AllowedTransition =
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULE_PROPOSED';

const TRANSITIONS: AllowedTransition[] = [
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULE_PROPOSED',
];

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: TRANSITIONS, example: 'CONFIRMED' })
  @IsEnum(TRANSITIONS, {
    message:
      'status must be CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | RESCHEDULE_PROPOSED',
  })
  status: AllowedTransition;

  @ApiPropertyOptional({
    example: '2026-07-16T14:00:00.000Z',
    description: 'New date proposed by the provider — required when status=RESCHEDULE_PROPOSED',
  })
  @IsOptional()
  @IsDateString()
  proposedDate?: string;
}
