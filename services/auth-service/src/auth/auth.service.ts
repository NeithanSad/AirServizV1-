import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { UserEntity } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

// JWT issuer — must match the Kong consumer's jwt_secret `key` so the API
// gateway can validate tokens (see infra/kong/kong.yaml).
const JWT_ISSUER = 'airserviz-auth';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<TokenPair> {
    const exists = await this.users.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.users.create({
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role ?? 'CLIENT',
      passwordHash,
    });
    const saved = await this.users.save(user);

    const tokens = await this.issueTokens(saved);
    this.logger.log(`New user registered: ${saved.email} (${saved.role})`);
    return tokens;
  }

  // ── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<TokenPair> {
    // Load password hash (excluded by default via select:false)
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  // ── Refresh ──────────────────────────────────────────────────────────────
  async refresh(token: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      }) as { sub: string };
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.refreshTokenHash')
      .where('u.id = :id', { id: payload.sub })
      .getOne();

    if (!user?.refreshTokenHash) throw new UnauthorizedException('Session expired');

    const match = await bcrypt.compare(this.digestToken(token), user.refreshTokenHash);
    if (!match) throw new UnauthorizedException('Refresh token revoked');

    return this.issueTokens(user);
  }

  // ── Me ───────────────────────────────────────────────────────────────────
  async findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  // ── Private ──────────────────────────────────────────────────────────────
  private async issueTokens(user: UserEntity): Promise<TokenPair> {
    const secret = this.config.get<string>('JWT_SECRET');
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES', '15m');
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES', '7d');

    const jwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwt.sign(jwtPayload, {
      secret,
      expiresIn: accessExpiresIn,
      issuer: JWT_ISSUER, // sets the `iss` claim Kong validates against
    });
    const refreshToken = this.jwt.sign(
      { sub: user.id },
      { secret, expiresIn: refreshExpiresIn, issuer: JWT_ISSUER },
    );

    // Store hashed refresh token
    user.refreshTokenHash = await bcrypt.hash(this.digestToken(refreshToken), 10);
    await this.users.save(user);

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  /**
   * bcrypt silently truncates its input to 72 bytes. Two JWTs for the same
   * user share an identical prefix (header + `sub`), and the claims that
   * actually distinguish them (`iat`/`exp`) sit past that limit — so hashing
   * raw tokens directly with bcrypt would make bcrypt.compare() accept a
   * STALE refresh token that only differs after byte 72, silently breaking
   * revoke-on-relogin. Pre-hashing with SHA-256 (fixed 64 hex chars) folds
   * the whole token into bcrypt's input window before it gets truncated.
   */
  private digestToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
