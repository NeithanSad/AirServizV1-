import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /** POST /orders — Create order, persist to DB, emit order_created to Kafka */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order (emits order_created to Kafka)' })
  @ApiHeader({ name: 'x-client-id', description: 'Authenticated client UUID', required: true })
  @ApiCreatedResponse({ description: 'Order created' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @Headers('x-client-id') clientId: string,
  ) {
    this.logger.log(`POST /orders — clientId=${clientId ?? 'anonymous'}`);
    const order = await this.ordersService.createOrder(clientId ?? 'anonymous', dto);
    return { success: true, data: order };
  }

  /** GET /orders — List orders, filtered by providerId and/or clientId */
  @Get()
  @ApiOperation({ summary: 'List orders (providerId for provider dashboard, clientId for client requests)' })
  @ApiQuery({ name: 'providerId', required: false, description: 'Filter by provider UUID' })
  @ApiQuery({ name: 'clientId', required: false, description: 'Filter by client UUID' })
  @ApiOkResponse({ description: 'List of orders' })
  async findAll(
    @Query('providerId') providerId?: string,
    @Query('clientId') clientId?: string,
  ) {
    const orders = await this.ordersService.findAll({ providerId, clientId });
    return { success: true, count: orders.length, data: orders };
  }

  /** GET /orders/:id — Get single order */
  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiOkResponse({ description: 'Order found' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async findOne(@Param('id') id: string) {
    const order = await this.ordersService.findOne(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return { success: true, data: order };
  }

  /** PATCH /orders/:id/status — Provider confirms/starts/reschedules; client accepts/cancels */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (provider or client action — emits event to Kafka)' })
  @ApiHeader({ name: 'x-actor-id', description: 'UUID of the user performing the action', required: true })
  @ApiOkResponse({ description: 'Status updated and event emitted' })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiForbiddenResponse({ description: 'Actor is not the provider assigned to this order' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Headers('x-actor-id') actorId: string,
  ) {
    this.logger.log(`PATCH /orders/${id}/status → ${dto.status} by actor=${actorId}`);
    const order = await this.ordersService.updateStatus(id, dto, actorId ?? 'unknown');
    return { success: true, data: order };
  }
}
