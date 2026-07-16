import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServicesService } from './services.service';
import { ServiceEntity } from './entities/service.entity';
import { RedisCacheService } from '../cache/redis-cache.service';

/**
 * Exercises the cache-aside read path and the ownership rules on writes.
 * Postgres is faked with an in-memory repo; Redis is faked with a real
 * Map + version counter that mirrors RedisCacheService's public contract
 * (key/getJson/setJson/invalidate), so the version-bump invalidation
 * strategy is genuinely exercised, not assumed.
 */

class InMemoryServiceRepo {
  rows: ServiceEntity[] = [];
  private seq = 0;
  findCalls = 0;

  create(data: Partial<ServiceEntity>): ServiceEntity {
    return Object.assign(new ServiceEntity(), { active: true, ...data });
  }

  async save(entity: ServiceEntity): Promise<ServiceEntity> {
    if (!entity.id) entity.id = `svc-${++this.seq}`;
    if (!entity.createdAt) entity.createdAt = new Date();
    const idx = this.rows.findIndex((r) => r.id === entity.id);
    if (idx >= 0) this.rows[idx] = entity;
    else this.rows.push(entity);
    return entity;
  }

  async find({ where }: { where: Partial<ServiceEntity> }): Promise<ServiceEntity[]> {
    this.findCalls++;
    return this.rows.filter((r) =>
      Object.entries(where).every(([k, v]) => r[k as keyof ServiceEntity] === v),
    );
  }

  async findOne({ where }: { where: { id: string } }): Promise<ServiceEntity | null> {
    return this.rows.find((r) => r.id === where.id) ?? null;
  }

  async count(): Promise<number> {
    return this.rows.length;
  }
}

/** Mirrors RedisCacheService's public contract with a real Map, no network. */
class FakeCacheService {
  private store = new Map<string, unknown>();
  private version = 0;

  async key(...parts: (string | undefined)[]): Promise<string> {
    return `catalog:v${this.version}:${parts.map((p) => p ?? 'all').join(':')}`;
  }
  async getJson<T>(k: string): Promise<T | null> {
    return (this.store.get(k) as T) ?? null;
  }
  async setJson(k: string, v: unknown): Promise<void> {
    this.store.set(k, v);
  }
  async invalidate(): Promise<void> {
    this.version++; // orphans every previously-cached key, same as the real service
  }
}

const OWNER_ID = 'provider-1';
const OTHER_PROVIDER_ID = 'provider-2';

describe('ServicesService', () => {
  let service: ServicesService;
  let repo: InMemoryServiceRepo;
  let cache: FakeCacheService;

  beforeEach(async () => {
    repo = new InMemoryServiceRepo();
    cache = new FakeCacheService();

    const module = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: getRepositoryToken(ServiceEntity), useValue: repo },
        { provide: RedisCacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  // providerId is a real parameter (not part of the DTO — the service takes
  // ownership from the authenticated actor, never from client-supplied data).
  async function createService(providerId = OWNER_ID, overrides: Partial<ServiceEntity> = {}) {
    return service.create(providerId, {
      name: 'Reparación de fugas',
      price: 150,
      category: 'PLOMERIA',
      ...overrides,
    } as any);
  }

  describe('findAll — cache-aside', () => {
    it('MISSes on the first call (hits Postgres) and HITs on the second (no extra Postgres call)', async () => {
      await createService();

      const first = await service.findAll({});
      expect(repo.findCalls).toBe(1);
      expect(first).toHaveLength(1);

      const second = await service.findAll({});
      expect(repo.findCalls).toBe(1); // still 1 — served from cache
      expect(second).toEqual(first);
    });

    it('keys different filter combinations separately (no cross-contamination)', async () => {
      await createService(OWNER_ID);
      await createService(OTHER_PROVIDER_ID);

      const forOwner = await service.findAll({ providerId: OWNER_ID });
      const forOther = await service.findAll({ providerId: OTHER_PROVIDER_ID });

      expect(forOwner).toHaveLength(1);
      expect(forOther).toHaveLength(1);
      expect(forOwner[0].providerId).toBe(OWNER_ID);
    });
  });

  describe('create', () => {
    it('invalidates the cache — a stale list is not served after a new service is published', async () => {
      await service.findAll({}); // primes an empty-list cache entry
      expect(await service.findAll({})).toHaveLength(0);

      await createService();

      const after = await service.findAll({});
      expect(after).toHaveLength(1); // would still be 0 if invalidation didn't run
    });
  });

  describe('findOne', () => {
    it('throws 404 for a missing service', async () => {
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('caches the result after a Postgres hit', async () => {
      const created = await createService();
      await service.findOne(created.id);
      const cachedDirect = await cache.getJson(await cache.key('id', created.id));
      expect(cachedDirect).toBeTruthy();
    });
  });

  describe('update — ownership', () => {
    it('rejects an actor who does not own the service', async () => {
      const created = await createService();
      await expect(
        service.update(created.id, OTHER_PROVIDER_ID, { price: 200 } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reads ownership from Postgres directly, ignoring a stale/wrong cached copy', async () => {
      const created = await createService();
      // Poison the cache with a copy claiming a different owner
      await cache.setJson(await cache.key('id', created.id), {
        ...created,
        providerId: OTHER_PROVIDER_ID,
      });

      // Real ownership (Postgres) is still OWNER_ID, so OWNER_ID must succeed
      const updated = await service.update(created.id, OWNER_ID, { price: 175 } as any);
      expect(Number(updated.price)).toBe(175);
    });

    it('the owner can update and the change is visible on the next read (cache invalidated)', async () => {
      const created = await createService();
      await service.findAll({}); // prime the list cache

      await service.update(created.id, OWNER_ID, { name: 'Nuevo nombre' } as any);

      const list = await service.findAll({});
      expect(list[0].name).toBe('Nuevo nombre');
    });

    it('throws 404 for a missing service', async () => {
      await expect(
        service.update('missing-id', OWNER_ID, { price: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove — ownership + soft delete', () => {
    it('rejects an actor who does not own the service', async () => {
      const created = await createService();
      await expect(service.remove(created.id, OTHER_PROVIDER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('soft-deletes (active=false) rather than removing the row', async () => {
      const created = await createService();
      await service.remove(created.id, OWNER_ID);

      expect(repo.rows).toHaveLength(1); // row still exists
      expect(repo.rows[0].active).toBe(false);
    });

    it('a deactivated service no longer appears in findAll', async () => {
      const created = await createService();
      await service.remove(created.id, OWNER_ID);

      const list = await service.findAll({});
      expect(list).toHaveLength(0);
    });
  });
});
