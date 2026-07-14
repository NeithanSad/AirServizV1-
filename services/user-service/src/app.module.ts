import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoParams } from './logging/pino.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from './profiles/profiles.module';
import { ProfileEntity } from './profiles/entities/profile.entity';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // Logging estructurado (pino) — consola + Logstash/ELK si LOG_TCP_HOST
    LoggerModule.forRoot(buildPinoParams('user-service')),
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
        // Versioned migrations replace synchronize (run on startup).
        synchronize: false,
        migrations: [__dirname + '/database/migrations/*.js'],
        migrationsRun: true,
        ssl: false,
      }),
    }),
    ProfilesModule,
    MetricsModule,
  ],
})
export class AppModule {}
