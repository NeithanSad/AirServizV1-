import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SERVICE_CATEGORIES, ServiceCategory } from './entities/service.entity';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  private readonly logger = new Logger(ServicesController.name);

  constructor(private readonly servicesService: ServicesService) {}

  /** POST /services — Provider publishes a new service */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a service offering (provider action)' })
  @ApiHeader({ name: 'x-actor-id', description: 'Provider UUID publishing the service', required: true })
  @ApiCreatedResponse({ description: 'Service created' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(@Body() dto: CreateServiceDto, @Headers('x-actor-id') actorId: string) {
    if (!actorId) throw new BadRequestException('x-actor-id header is required');
    this.logger.log(`POST /services — provider=${actorId}`);
    const service = await this.servicesService.create(actorId, dto);
    return { success: true, data: service };
  }

  /** GET /services — Public catalog listing */
  @Get()
  @ApiOperation({ summary: 'List active services (filter by provider and/or category)' })
  @ApiQuery({ name: 'providerId', required: false, description: 'Filter by provider UUID' })
  @ApiQuery({ name: 'category', required: false, enum: SERVICE_CATEGORIES })
  @ApiOkResponse({ description: 'List of active services' })
  async findAll(
    @Query('providerId') providerId?: string,
    @Query('category') category?: ServiceCategory,
  ) {
    const services = await this.servicesService.findAll({ providerId, category });
    return { success: true, count: services.length, data: services };
  }

  /** GET /services/:id */
  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID' })
  @ApiOkResponse({ description: 'Service found' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  async findOne(@Param('id') id: string) {
    const service = await this.servicesService.findOne(id);
    return { success: true, data: service };
  }

  /** PATCH /services/:id — Owner updates name/price/category/etc. */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a service (owner only)' })
  @ApiHeader({ name: 'x-actor-id', description: 'Provider UUID performing the action', required: true })
  @ApiOkResponse({ description: 'Service updated' })
  @ApiForbiddenResponse({ description: 'Actor does not own this service' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @Headers('x-actor-id') actorId: string,
  ) {
    this.logger.log(`PATCH /services/${id} — actor=${actorId}`);
    const service = await this.servicesService.update(id, actorId ?? 'unknown', dto);
    return { success: true, data: service };
  }

  /** DELETE /services/:id — Soft-delete (deactivate) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a service (owner only, soft delete)' })
  @ApiHeader({ name: 'x-actor-id', description: 'Provider UUID performing the action', required: true })
  @ApiNoContentResponse({ description: 'Service deactivated' })
  @ApiForbiddenResponse({ description: 'Actor does not own this service' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  async remove(@Param('id') id: string, @Headers('x-actor-id') actorId: string) {
    this.logger.log(`DELETE /services/${id} — actor=${actorId}`);
    await this.servicesService.remove(id, actorId ?? 'unknown');
  }
}
