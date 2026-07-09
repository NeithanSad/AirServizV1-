import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  Headers,
  Logger,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { ProfileRole } from './entities/profile.entity';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  private readonly logger = new Logger(ProfilesController.name);

  constructor(private readonly profilesService: ProfilesService) {}

  /** GET /profiles — List profiles (role=PROVIDER powers the client-app dropdown) */
  @Get()
  @ApiOperation({ summary: 'List profiles (filter by role, e.g. PROVIDER)' })
  @ApiQuery({ name: 'role', required: false, enum: ['CLIENT', 'PROVIDER', 'ADMIN'] })
  @ApiOkResponse({ description: 'List of profiles' })
  async findAll(@Query('role') role?: ProfileRole) {
    const profiles = await this.profilesService.findAll(role);
    return { success: true, count: profiles.length, data: profiles };
  }

  /** GET /profiles/:userId */
  @Get(':userId')
  @ApiOperation({ summary: 'Get profile by user ID' })
  @ApiOkResponse({ description: 'Profile found' })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  async findOne(@Param('userId', ParseUUIDPipe) userId: string) {
    const profile = await this.profilesService.findOne(userId);
    return { success: true, data: profile };
  }

  /** PUT /profiles/:userId — Create or update own profile */
  @Put(':userId')
  @ApiOperation({ summary: 'Create or update a profile (owner only)' })
  @ApiHeader({ name: 'x-actor-id', description: 'UUID of the user performing the action', required: true })
  @ApiOkResponse({ description: 'Profile created or updated' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Actor can only edit their own profile' })
  async upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpsertProfileDto,
    @Headers('x-actor-id') actorId: string,
  ) {
    if (actorId !== userId) {
      throw new ForbiddenException('You can only edit your own profile');
    }
    this.logger.log(`PUT /profiles/${userId}`);
    const profile = await this.profilesService.upsert(userId, dto);
    return { success: true, data: profile };
  }
}
