import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ProfileEntity } from '../profiles/entities/profile.entity';

/** TypeORM DataSource used by the migration CLI (ts-node). */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  database: process.env.DB_NAME ?? 'users_db',
  username: process.env.DB_USER ?? 'users_admin',
  password: process.env.DB_PASS,
  entities: [ProfileEntity],
  migrations: ['src/database/migrations/*.ts'],
});
