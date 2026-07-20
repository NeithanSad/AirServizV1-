import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoParams } from './logging/pino.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from './kafka/kafka.module';
import { OrdersModule } from './orders/orders.module';
import { OrderEntity } from './orders/entities/order.entity';
import { MetricsModule } from './metrics/metrics.module';
import { SharedAuthModule } from './shared-auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // Verificación de identidad a partir del JWT. Global: cualquier controlador
    // puede usar @UseGuards(JwtAuthGuard) sin importarlo de nuevo.
    SharedAuthModule,
    // Logging estructurado (pino) — consola + Logstash/ELK si LOG_TCP_HOST
    LoggerModule.forRoot(buildPinoParams('booking-service')),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5434),
        database: cfg.get<string>('DB_NAME', 'bookings_db'),
        username: cfg.get<string>('DB_USER', 'bookings_admin'),
        password: cfg.get<string>('DB_PASS'),
        entities: [OrderEntity],
        // Versioned migrations replace synchronize (run on startup).
        synchronize: false,
        migrations: [__dirname + '/database/migrations/*.js'],
        migrationsRun: true,
        ssl: false,
      }),
    }),
    KafkaModule,
    OrdersModule,
    MetricsModule,
  ],
})
export class AppModule {}
