import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceEntity } from './entities/service.entity';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceEntity]), CacheModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
