import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cache-aside wrapper over Redis for the catalog.
 *
 * Invalidation strategy: a namespace VERSION key (`catalog:ver`). Every cache
 * key embeds the current version; a write (POST/PATCH/DELETE) just INCRs the
 * version, which instantly orphans every older key — O(1) invalidation, no
 * SCAN/DEL sweeps. Orphaned entries expire on their own via TTL.
 *
 * Availability contract: Redis being down must NEVER break the catalog.
 * Every operation is wrapped so failures degrade to a cache miss and the
 * caller falls through to Postgres.
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private available = true; // avoid log spam while Redis is down

  private static readonly VERSION_KEY = 'catalog:ver';

  constructor(config: ConfigService) {
    this.ttlSeconds = Number(config.get('CACHE_TTL_SECONDS', 60));
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(config.get('REDIS_PORT', 6379)),
      lazyConnect: false,
      maxRetriesPerRequest: 1, // fail fast → fall through to Postgres
      // Critical for graceful degradation: without this, commands issued
      // while Redis is down sit in an offline queue and the HTTP request
      // hangs instead of falling back to Postgres.
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5_000),
    });

    this.redis.on('ready', () => {
      this.available = true;
      this.logger.log('Redis connected — catalog cache enabled');
    });
    this.redis.on('error', (err) => {
      if (this.available) {
        this.logger.warn(`Redis unavailable — serving from Postgres only (${err.message})`);
        this.available = false;
      }
    });
  }

  /** Current namespace version (part of every cache key) */
  async getVersion(): Promise<number> {
    const v = await this.redis.get(RedisCacheService.VERSION_KEY);
    return v ? Number(v) : 0;
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // degraded mode → miss
    }
  }

  async setJson(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch {
      /* degraded mode → skip write */
    }
  }

  /** O(1) invalidation: bump the namespace version, orphaning all old keys */
  async invalidate(reason: string): Promise<void> {
    try {
      const ver = await this.redis.incr(RedisCacheService.VERSION_KEY);
      this.logger.log(`Cache invalidated (${reason}) — namespace now v${ver}`);
    } catch {
      /* degraded mode → nothing cached anyway */
    }
  }

  /** Build a namespaced key: catalog:v3:list:all:HOGAR */
  async key(...parts: (string | undefined)[]): Promise<string> {
    const ver = await this.safeVersion();
    return `catalog:v${ver}:${parts.map((p) => p ?? 'all').join(':')}`;
  }

  private async safeVersion(): Promise<number> {
    try {
      return await this.getVersion();
    } catch {
      return 0;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
