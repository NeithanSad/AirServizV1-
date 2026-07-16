import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity';

/**
 * TypeORM DataSource used by the migration CLI (ts-node).
 * Env vars mirror app.module so it targets the same database.
 * At runtime the app runs compiled migrations via migrationsRun (see app.module).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  database: process.env.DB_NAME ?? 'users_db',
  username: process.env.DB_USER ?? 'users_admin',
  password: process.env.DB_PASS,
  entities: [UserEntity],
  migrations: ['src/database/migrations/*.ts'],
});
