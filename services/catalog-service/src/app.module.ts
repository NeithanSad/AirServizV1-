import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoParams } from './logging/pino.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesModule } from './services/services.module';
import { ServiceEntity } from './services/entities/service.entity';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // Logging estructurado (pino) — consola + Logstash/ELK si LOG_TCP_HOST
    LoggerModule.forRoot(buildPinoParams('catalog-service')),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5435),
        database: cfg.get<string>('DB_NAME', 'catalog_db'),
        username: cfg.get<string>('DB_USER', 'catalog_admin'),
        password: cfg.get<string>('DB_PASS'),
        entities: [ServiceEntity],
        // Versioned migrations replace synchronize (run on startup).
        synchronize: false,
        migrations: [__dirname + '/database/migrations/*.js'],
        migrationsRun: true,
        ssl: false,
      }),
    }),
    ServicesModule,
    MetricsModule,
  ],
})
export class AppModule {}
