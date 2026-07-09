import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ProfileRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';

@Entity('profiles')
export class ProfileEntity {
  /** Same UUID as the auth-service users.id — 1:1 profile per user */
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ length: 120 })
  fullName: string;

  @Index()
  @Column({ type: 'varchar', default: 'CLIENT' })
  role: ProfileRole;

  @Column({ type: 'varchar', length: 300, nullable: true })
  bio: string;

  /** Free stock image URL — no upload pipeline yet */
  @Column({ type: 'varchar', length: 500, nullable: true })
  photoUrl: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string;

  // ── Location ──────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address: string;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  longitude: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
