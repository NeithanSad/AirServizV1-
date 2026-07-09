import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user and receive JWT tokens' })
  @ApiCreatedResponse({ description: 'User registered, tokens issued' })
  async register(@Body() dto: RegisterDto) {
    const tokens = await this.authService.register(dto);
    return { success: true, data: tokens };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  @ApiOkResponse({ description: 'Tokens issued' })
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login(dto);
    return { success: true, data: tokens };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('refreshToken is required');
    const tokens = await this.authService.refresh(refreshToken);
    return { success: true, data: tokens };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Authorization', description: 'Bearer <accessToken>' })
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  async me(@Headers('authorization') authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }
    const token = authHeader.slice(7);
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      }) as { sub: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.authService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return { success: true, data: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } };
  }
}
