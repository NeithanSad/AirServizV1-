import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesModule } from './services/services.module';
import { ServiceEntity } from './services/entities/service.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
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
        synchronize: true, // auto-creates tables — use migrations in production
        ssl: false,
      }),
    }),
    ServicesModule,
  ],
})
export class AppModule {}
