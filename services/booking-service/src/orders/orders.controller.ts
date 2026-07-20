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
  Logger,
  NotFoundException,
  ForbiddenException,
  UseGuards,
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
import { JwtAuthGuard, AuthenticatedUser } from '../shared-auth/jwt-auth.guard';
import { CurrentUser } from '../shared-auth/current-user.decorator';

@ApiTags('orders')
@ApiBearerAuth()
// Toda ruta de órdenes exige un token válido y deriva de él la identidad.
// Antes se leía de las cabeceras `x-actor-id` / `x-client-id`, que enviaba el
// propio cliente: bastaba con cambiarlas para leer o modificar órdenes ajenas.
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /** POST /orders — Create order, persist to DB, emit order_created to Kafka */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order (emits order_created to Kafka)' })
  @ApiCreatedResponse({ description: 'Order created' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // El cliente de la orden es siempre quien la pide, tomado del token. Antes
    // llegaba en la cabecera `x-client-id` y se podía crear una orden a nombre
    // de otra persona.
    this.logger.log(`POST /orders — clientId=${user.id}`);
    const order = await this.ordersService.createOrder(user.id, dto);
    return { success: true, data: order };
  }

  /** GET /orders — Órdenes del usuario autenticado */
  @Get()
  @ApiOperation({
    summary: 'List the authenticated user\'s own orders',
    description:
      'Devuelve únicamente órdenes en las que el usuario del token participa, ' +
      'como cliente o como proveedor. `role` acota a una de las dos caras; no ' +
      'existe forma de consultar las órdenes de otra persona.',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['client', 'provider'],
    description: 'Acota a las órdenes donde actúas como cliente o como proveedor',
  })
  @ApiOkResponse({ description: 'List of orders' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('role') role?: 'client' | 'provider',
  ) {
    // El panel de administración es una consola de supervisión y necesita ver
    // todas las transacciones. Es la ÚNICA vía sin acotar, y depende del claim
    // `role` del token firmado — no de un parámetro que el cliente elija.
    if (user.role === 'ADMIN') {
      const all = await this.ordersService.findAllUnscoped({});
      this.logger.log(`GET /orders — consulta administrativa por ${user.id}`);
      return { success: true, count: all.length, data: all };
    }

    const orders = await this.ordersService.findAllForUser(user.id, { role });
    return { success: true, count: orders.length, data: orders };
  }

  /** GET /orders/:id — Solo si el usuario participa en la orden */
  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID (only if you are a party to it)' })
  @ApiOkResponse({ description: 'Order found' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiForbiddenResponse({ description: 'You are not a party to this order' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const order = await this.ordersService.findOne(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    // Conocer un UUID no da derecho a leer la orden: hay que ser parte de ella.
    if (order.clientId !== user.id && order.providerId !== user.id) {
      throw new ForbiddenException('No participas en esta orden');
    }

    return { success: true, data: order };
  }

  /** PATCH /orders/:id/status — Provider confirms/starts/reschedules; client accepts/cancels */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (provider or client action — emits event to Kafka)' })
  @ApiOkResponse({ description: 'Status updated and event emitted' })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiForbiddenResponse({ description: 'You are not allowed to perform this transition' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // El actor es quien firma el token, no quien lo diga una cabecera. Las
    // reglas de propiedad de la máquina de estados (el proveedor confirma, solo
    // el cliente acepta una reprogramación) descansan en este valor: si se
    // puede falsificar, no protegen nada.
    this.logger.log(`PATCH /orders/${id}/status → ${dto.status} by actor=${user.id}`);
    const order = await this.ordersService.updateStatus(id, dto, user.id);
    return { success: true, data: order };
  }
}
