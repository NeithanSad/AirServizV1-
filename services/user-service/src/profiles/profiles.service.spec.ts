import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfilesService } from './profiles.service';
import { ProfileEntity, ProfileRole } from './entities/profile.entity';

class InMemoryProfileRepo {
  rows: ProfileEntity[] = [];

  create(data: Partial<ProfileEntity>): ProfileEntity {
    return Object.assign(new ProfileEntity(), data);
  }

  async save(entity: ProfileEntity): Promise<ProfileEntity> {
    const idx = this.rows.findIndex((r) => r.userId === entity.userId);
    if (idx >= 0) this.rows[idx] = entity;
    else this.rows.push(entity);
    return entity;
  }

  async findOne({ where }: { where: { userId: string } }): Promise<ProfileEntity | null> {
    return this.rows.find((r) => r.userId === where.userId) ?? null;
  }

  async find({ where }: { where: Partial<ProfileEntity> }): Promise<ProfileEntity[]> {
    return this.rows.filter((r) =>
      Object.entries(where).every(([k, v]) => r[k as keyof ProfileEntity] === v),
    );
  }

  async count(): Promise<number> {
    return this.rows.length;
  }
}

describe('ProfilesService', () => {
  let service: ProfilesService;
  let repo: InMemoryProfileRepo;

  beforeEach(async () => {
    repo = new InMemoryProfileRepo();
    const module = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(ProfileEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(ProfilesService);
  });

  describe('upsert', () => {
    it('creates a new profile when none exists for the userId', async () => {
      const created = await service.upsert('user-1', {
        fullName: 'Cliente Uno',
      } as any);
      expect(created.userId).toBe('user-1');
      expect(repo.rows).toHaveLength(1);
    });

    it('updates the existing profile in place instead of creating a duplicate', async () => {
      await service.upsert('user-1', { fullName: 'Nombre Original', city: 'Lima' } as any);
      const updated = await service.upsert('user-1', { fullName: 'Nombre Nuevo' } as any);

      expect(repo.rows).toHaveLength(1); // no duplicate row
      expect(updated.fullName).toBe('Nombre Nuevo');
    });

    it('a partial upsert preserves fields not included in the new dto', async () => {
      await service.upsert('user-1', {
        fullName: 'Proveedor Uno',
        city: 'Lima',
        phone: '+51 999 111 222',
      } as any);

      // Only fullName is sent this time — city/phone should survive
      const updated = await service.upsert('user-1', { fullName: 'Proveedor Actualizado' } as any);
      expect(updated.city).toBe('Lima');
      expect(updated.phone).toBe('+51 999 111 222');
    });
  });

  describe('findOne', () => {
    it('throws 404 for a profile that does not exist', async () => {
      await expect(service.findOne('missing-user')).rejects.toThrow(NotFoundException);
    });

    it('returns the profile when it exists', async () => {
      await service.upsert('user-1', { fullName: 'Alguien' } as any);
      const found = await service.findOne('user-1');
      expect(found.fullName).toBe('Alguien');
    });
  });

  describe('findAll', () => {
    it('lists every profile when no role filter is given', async () => {
      await service.upsert('user-1', { fullName: 'A', role: 'CLIENT' as ProfileRole } as any);
      await service.upsert('user-2', { fullName: 'B', role: 'PROVIDER' as ProfileRole } as any);
      expect(await service.findAll()).toHaveLength(2);
    });

    it('filters by role — powers the client-app provider dropdown', async () => {
      await service.upsert('user-1', { fullName: 'A', role: 'CLIENT' as ProfileRole } as any);
      await service.upsert('user-2', { fullName: 'B', role: 'PROVIDER' as ProfileRole } as any);

      const providers = await service.findAll('PROVIDER');
      expect(providers).toHaveLength(1);
      expect(providers[0].userId).toBe('user-2');
    });
  });
});
