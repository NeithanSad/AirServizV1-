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

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectRepository(ServiceEntity)
    private readonly repo: Repository<ServiceEntity>,
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
    this.logger.log(`Service "${saved.name}" created by provider ${providerId}`);
    return saved;
  }

  // ── Read ─────────────────────────────────────────────────────────────────
  findAll(filters: { providerId?: string; category?: ServiceCategory }): Promise<ServiceEntity[]> {
    return this.repo.find({
      where: {
        active: true,
        ...(filters.providerId && { providerId: filters.providerId }),
        ...(filters.category && { category: filters.category }),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ServiceEntity> {
    const service = await this.repo.findOne({ where: { id } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, actorId: string, dto: UpdateServiceDto): Promise<ServiceEntity> {
    const service = await this.findOne(id);
    this.assertOwnership(service, actorId);
    Object.assign(service, dto);
    const saved = await this.repo.save(service);
    this.logger.log(`Service ${id} updated by provider ${actorId}`);
    return saved;
  }

  // ── Delete (soft) ────────────────────────────────────────────────────────
  async remove(id: string, actorId: string): Promise<void> {
    const service = await this.findOne(id);
    this.assertOwnership(service, actorId);
    service.active = false;
    await this.repo.save(service);
    this.logger.log(`Service ${id} deactivated by provider ${actorId}`);
  }

  private assertOwnership(service: ServiceEntity, actorId: string): void {
    if (service.providerId !== actorId) {
      throw new ForbiddenException('Only the provider that owns this service can modify it');
    }
  }
}
