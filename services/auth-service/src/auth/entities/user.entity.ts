import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column({ length: 255, select: false }) // never returned in queries by default
  passwordHash: string;

  @Column({ length: 120 })
  fullName: string;

  @Column({ type: 'varchar', default: 'CLIENT' })
  role: UserRole;

  /** Hashed refresh token — empty string when logged out */
  @Column({ type: 'varchar', nullable: true, select: false })
  refreshTokenHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
