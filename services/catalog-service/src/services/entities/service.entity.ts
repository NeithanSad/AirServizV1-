import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export const SERVICE_CATEGORIES = [
  'PLOMERIA',
  'ELECTRICIDAD',
  'LIMPIEZA',
  'JARDINERIA',
  'PINTURA',
  'CLIMATIZACION',
  'OTROS',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

@Entity('services')
export class ServiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Provider (user) that offers this service */
  @Index()
  @Column({ type: 'varchar', length: 36 })
  providerId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column('numeric', { precision: 10, scale: 2 })
  price: number;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  category: ServiceCategory;

  /** Free stock image URL — no upload pipeline yet */
  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string;

  /** Soft-delete flag: inactive services are hidden from the catalog */
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
