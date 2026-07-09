import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { OrderEntity } from '../orders/entities/order.entity';

/** TypeORM DataSource used by the migration CLI (ts-node). */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5434),
  database: process.env.DB_NAME ?? 'bookings_db',
  username: process.env.DB_USER ?? 'bookings_admin',
  password: process.env.DB_PASS,
  entities: [OrderEntity],
  migrations: ['src/database/migrations/*.ts'],
});
