import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PaymentEntity } from '../payments/entities/payment.entity';

/** TypeORM DataSource used by the migration CLI (ts-node). */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5436),
  database: process.env.DB_NAME ?? 'payments_db',
  username: process.env.DB_USER ?? 'payments_admin',
  password: process.env.DB_PASS,
  entities: [PaymentEntity],
  migrations: ['src/database/migrations/*.ts'],
});
