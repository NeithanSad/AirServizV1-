import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ServiceEntity } from '../services/entities/service.entity';

/** TypeORM DataSource used by the migration CLI (ts-node). */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5435),
  database: process.env.DB_NAME ?? 'catalog_db',
  username: process.env.DB_USER ?? 'catalog_admin',
  password: process.env.DB_PASS,
  entities: [ServiceEntity],
  migrations: ['src/database/migrations/*.ts'],
});
