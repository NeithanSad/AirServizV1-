import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity, ProfileRole } from './entities/profile.entity';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { DEMO_PROFILES } from './seed/demo-profiles.seed';

@Injectable()
export class ProfilesService implements OnModuleInit {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @InjectRepository(ProfileEntity)
    private readonly repo: Repository<ProfileEntity>,
  ) {}

  /** Seed demo providers on first boot so the client-app dropdown has data */
  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;
    await this.repo.save(this.repo.create(DEMO_PROFILES));
    this.logger.log(`Seeded ${DEMO_PROFILES.length} demo profiles (table was empty)`);
  }

  // ── Read ─────────────────────────────────────────────────────────────────
  findAll(role?: ProfileRole): Promise<ProfileEntity[]> {
    return this.repo.find({
      where: role ? { role } : {},
      order: { fullName: 'ASC' },
    });
  }

  async findOne(userId: string): Promise<ProfileEntity> {
    const profile = await this.repo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException(`Profile for user ${userId} not found`);
    return profile;
  }

  // ── Upsert ───────────────────────────────────────────────────────────────
  async upsert(userId: string, dto: UpsertProfileDto): Promise<ProfileEntity> {
    const existing = await this.repo.findOne({ where: { userId } });
    const profile = existing
      ? Object.assign(existing, dto)
      : this.repo.create({ ...dto, userId });
    const saved = await this.repo.save(profile);
    this.logger.log(`Profile ${existing ? 'updated' : 'created'} for user ${userId}`);
    return saved;
  }
}
