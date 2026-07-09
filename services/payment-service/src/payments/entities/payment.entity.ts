import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type PaymentStatus =
  | 'REQUIRES_PAYMENT' // intent created, awaiting client action
  | 'PAID'
  | 'FAILED';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** One payment per order — enforces idempotency on order_confirmed */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @Column({ type: 'varchar', length: 36 })
  clientId: string;

  @Column({ type: 'varchar', length: 36 })
  providerId: string;

  @Column('numeric', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'usd' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'REQUIRES_PAYMENT' })
  status: PaymentStatus;

  /** Which gateway processed it (e.g. 'stripe-simulated') */
  @Column({ type: 'varchar', length: 40 })
  gateway: string;

  /** Provider-side PaymentIntent id (pi_...) */
  @Column({ type: 'varchar', length: 120, nullable: true })
  providerRef: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  clientSecret: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
