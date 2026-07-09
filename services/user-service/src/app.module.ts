import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from './profiles/profiles.module';
import { ProfileEntity } from './profiles/entities/profile.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        // Shares users_db with auth-service (same bounded context, own table)
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5433),
        database: cfg.get<string>('DB_NAME', 'users_db'),
        username: cfg.get<string>('DB_USER', 'users_admin'),
        password: cfg.get<string>('DB_PASS'),
        entities: [ProfileEntity],
        synchronize: true, // auto-creates tables — use migrations in production
        ssl: false,
      }),
    }),
    ProfilesModule,
  ],
})
export class AppModule {}
