import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserEntity } from './entities/user.entity';

/**
 * Exercises real bcrypt hashing/comparison and a real JwtService (signing +
 * verification) — the two security-critical pieces of auth-service. Only
 * Postgres is faked, via an in-memory repo that mimics the hidden-column
 * (select:false) behaviour that login()/refresh() rely on via
 * createQueryBuilder().addSelect(...).
 */

const JWT_SECRET = 'test-secret-at-least-32-characters-long';

// jsonwebtoken's `iat` claim has SECOND resolution (Math.floor(Date.now()/1000)).
// Two sign() calls with the same payload within the same wall-clock second
// produce byte-identical tokens. Freezing/advancing Date.now (not fake
// timers — those would also stall bcrypt's real async completion) lets
// tests deterministically mint two genuinely different tokens.
function freezeClockAt(ms: number) {
  jest.spyOn(Date, 'now').mockReturnValue(ms);
}

class FakeQueryBuilder {
  private whereClause = '';
  private whereParams: Record<string, string> = {};
  constructor(private readonly rows: UserEntity[]) {}
  addSelect() {
    return this;
  }
  where(clause: string, params: Record<string, string>) {
    this.whereClause = clause;
    this.whereParams = params;
    return this;
  }
  async getOne(): Promise<UserEntity | null> {
    if (this.whereClause.includes('email')) {
      return this.rows.find((r) => r.email === this.whereParams.email) ?? null;
    }
    if (this.whereClause.includes('id')) {
      return this.rows.find((r) => r.id === this.whereParams.id) ?? null;
    }
    return null;
  }
}

class InMemoryUserRepo {
  rows: UserEntity[] = [];
  private seq = 0;

  async findOne({ where }: { where: Partial<UserEntity> }): Promise<UserEntity | null> {
    return (
      this.rows.find((r) =>
        Object.entries(where).every(([k, v]) => r[k as keyof UserEntity] === v),
      ) ?? null
    );
  }

  create(data: Partial<UserEntity>): UserEntity {
    return Object.assign(new UserEntity(), data);
  }

  async save(entity: UserEntity): Promise<UserEntity> {
    if (!entity.id) entity.id = `user-${++this.seq}`;
    if (!entity.createdAt) entity.createdAt = new Date();
    const idx = this.rows.findIndex((r) => r.id === entity.id);
    if (idx >= 0) this.rows[idx] = entity;
    else this.rows.push(entity);
    return entity;
  }

  createQueryBuilder() {
    return new FakeQueryBuilder(this.rows);
  }
}

describe('AuthService', () => {
  let service: AuthService;
  let repo: InMemoryUserRepo;
  let jwt: JwtService;

  beforeEach(async () => {
    repo = new InMemoryUserRepo();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: repo },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) =>
              ({ JWT_SECRET, JWT_ACCESS_EXPIRES: '15m', JWT_REFRESH_EXPIRES: '7d' })[key] ??
              fallback,
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwt = module.get(JwtService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('hashes the password — never stores it in plain text', async () => {
      await service.register({
        email: 'client@airserviz.dev',
        password: 'PlainText123!',
        fullName: 'Cliente Demo',
      } as any);

      expect(repo.rows[0].passwordHash).not.toBe('PlainText123!');
      expect(await bcrypt.compare('PlainText123!', repo.rows[0].passwordHash)).toBe(true);
    });

    it('defaults role to CLIENT when not provided', async () => {
      await service.register({
        email: 'noRole@airserviz.dev',
        password: 'PlainText123!',
        fullName: 'Sin Rol',
      } as any);
      expect(repo.rows[0].role).toBe('CLIENT');
    });

    it('rejects a duplicate email', async () => {
      const dto = {
        email: 'dup@airserviz.dev',
        password: 'PlainText123!',
        fullName: 'Uno',
      } as any;
      await service.register(dto);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('returns a valid, verifiable access token with the right claims', async () => {
      const tokens = await service.register({
        email: 'provider@airserviz.dev',
        password: 'PlainText123!',
        fullName: 'Proveedor Demo',
        role: 'PROVIDER',
      } as any);

      const payload = jwt.verify(tokens.accessToken, { secret: JWT_SECRET }) as {
        sub: string;
        email: string;
        role: string;
        iss: string;
      };
      expect(payload.email).toBe('provider@airserviz.dev');
      expect(payload.role).toBe('PROVIDER');
      expect(payload.iss).toBe('airserviz-auth'); // Kong validates this claim
    });
  });

  describe('login', () => {
    async function registerUser() {
      return service.register({
        email: 'login@airserviz.dev',
        password: 'Correct123!',
        fullName: 'Login Test',
      } as any);
    }

    it('rejects an unknown email without leaking whether the account exists', async () => {
      await expect(
        service.login({ email: 'ghost@airserviz.dev', password: 'whatever' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects the wrong password', async () => {
      await registerUser();
      await expect(
        service.login({ email: 'login@airserviz.dev', password: 'WrongPassword' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues fresh tokens on the correct password', async () => {
      await registerUser();
      const tokens = await service.login({
        email: 'login@airserviz.dev',
        password: 'Correct123!',
      } as any);
      expect(tokens.accessToken).toBeDefined();
      expect(jwt.verify(tokens.accessToken, { secret: JWT_SECRET })).toBeTruthy();
    });
  });

  describe('refresh', () => {
    it('rejects a malformed/invalid token', async () => {
      await expect(service.refresh('not-a-real-jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a refresh token signed with a different secret', async () => {
      const forged = jwt.sign({ sub: 'user-1' }, { secret: 'wrong-secret-32-characters-long!' });
      await expect(service.refresh(forged)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a well-formed token for a session that was logged out (no stored hash)', async () => {
      const tokens = await service.register({
        email: 'nosession@airserviz.dev',
        password: 'Correct123!',
        fullName: 'No Session',
      } as any);
      // Simulate logout: server-side hash cleared, but the old JWT is still structurally valid
      repo.rows[0].refreshTokenHash = null as unknown as string;
      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a refresh token that does not match the stored hash (revoked by a newer login)', async () => {
      const t0 = Date.now();
      freezeClockAt(t0);
      const first = await service.register({
        email: 'revoked@airserviz.dev',
        password: 'Correct123!',
        fullName: 'Revoked',
      } as any);

      // A second login issues a new refresh token, overwriting the stored hash
      freezeClockAt(t0 + 2000);
      await service.login({ email: 'revoked@airserviz.dev', password: 'Correct123!' } as any);

      await expect(service.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('issues a new token pair for a valid, current refresh token', async () => {
      const t0 = Date.now();
      freezeClockAt(t0);
      const tokens = await service.register({
        email: 'fresh@airserviz.dev',
        password: 'Correct123!',
        fullName: 'Fresh',
      } as any);

      freezeClockAt(t0 + 2000);
      const renewed = await service.refresh(tokens.refreshToken);

      expect(renewed.accessToken).toBeDefined();
      expect(renewed.refreshToken).not.toBe(tokens.refreshToken);
    });
  });
});
