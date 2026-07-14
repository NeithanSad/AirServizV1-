import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceEntity, ServiceCategory } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { DEMO_SERVICES } from './seed/demo-catalog.seed';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectRepository(ServiceEntity)
    private readonly repo: Repository<ServiceEntity>,
    private readonly cache: RedisCacheService,
  ) {}

  /** Seed demo catalog on first boot so the client-app has real data to list */
  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;
    await this.repo.save(this.repo.create(DEMO_SERVICES));
    this.logger.log(`Seeded ${DEMO_SERVICES.length} demo services (table was empty)`);
  }

  // ── Create ───────────────────────────────────────────────────────────────
  async create(providerId: string, dto: CreateServiceDto): Promise<ServiceEntity> {
    const entity = this.repo.create({ ...dto, providerId });
    const saved = await this.repo.save(entity);
    await this.cache.invalidate(`POST /services by ${providerId}`);
    this.logger.log(`Service "${saved.name}" created by provider ${providerId}`);
    return saved;
  }

  // ── Read (cache-aside: Redis first, Postgres on miss) ───────────────────
  async findAll(filters: {
    providerId?: string;
    category?: ServiceCategory;
  }): Promise<ServiceEntity[]> {
    const key = await this.cache.key('list', filters.providerId, filters.category);

    const cached = await this.cache.getJson<ServiceEntity[]>(key);
    if (cached) {
      this.logger.debug(`cache HIT  ${key}`);
      return cached;
    }

    this.logger.debug(`cache MISS ${key} → Postgres`);
    const services = await this.repo.find({
      where: {
        active: true,
        ...(filters.providerId && { providerId: filters.providerId }),
        ...(filters.category && { category: filters.category }),
      },
      order: { createdAt: 'DESC' },
    });
    await this.cache.setJson(key, services);
    return services;
  }

  async findOne(id: string): Promise<ServiceEntity> {
    const key = await this.cache.key('id', id);

    const cached = await this.cache.getJson<ServiceEntity>(key);
    if (cached) {
      this.logger.debug(`cache HIT  ${key}`);
      return cached;
    }

    const service = await this.repo.findOne({ where: { id } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    await this.cache.setJson(key, service);
    return service;
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, actorId: string, dto: UpdateServiceDto): Promise<ServiceEntity> {
    // Ownership check must read the CURRENT row, never a cached copy
    const service = await this.repo.findOne({ where: { id } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    this.assertOwnership(service, actorId);
    Object.assign(service, dto);
    const saved = await this.repo.save(service);
    await this.cache.invalidate(`PATCH /services/${id}`);
    this.logger.log(`Service ${id} updated by provider ${actorId}`);
    return saved;
  }

  // ── Delete (soft) ────────────────────────────────────────────────────────
  async remove(id: string, actorId: string): Promise<void> {
    const service = await this.repo.findOne({ where: { id } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    this.assertOwnership(service, actorId);
    service.active = false;
    await this.repo.save(service);
    await this.cache.invalidate(`DELETE /services/${id}`);
    this.logger.log(`Service ${id} deactivated by provider ${actorId}`);
  }

  private assertOwnership(service: ServiceEntity, actorId: string): void {
    if (service.providerId !== actorId) {
      throw new ForbiddenException('Only the provider that owns this service can modify it');
    }
  }
}
