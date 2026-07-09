import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserEntity } from './auth/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5433),
        database: cfg.get<string>('DB_NAME', 'users_db'),
        username: cfg.get<string>('DB_USER', 'users_admin'),
        password: cfg.get<string>('DB_PASS'),
        entities: [UserEntity],
        synchronize: true, // auto-creates tables — use migrations in production
        ssl: false,
      }),
    }),
    AuthModule,
  ],
})
export class AppModule {}
