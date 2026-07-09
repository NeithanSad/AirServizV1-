import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('orders')
export class OrderEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clientId: string;

  @Column({ type: 'varchar', length: 36 })
  providerId: string;

  @Column('jsonb')
  items: Array<{ serviceId: string; quantity: number; unitPrice: number }>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string;  // nullable at DB level via nullable:true — avoid union type in TS metadata

  @Column({ length: 25, default: 'PENDING' })
  status: string;

  @Column('numeric', { precision: 10, scale: 2 })
  totalAmount: number;

  /** Date requested by the client for the service */
  @Column({ type: 'timestamptz', nullable: true })
  scheduledDate: Date;

  /** Alternative date proposed by the provider (pending client approval) */
  @Column({ type: 'timestamptz', nullable: true })
  proposedDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}
