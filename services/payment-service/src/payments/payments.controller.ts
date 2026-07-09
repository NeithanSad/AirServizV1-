import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { SimulatePaymentDto } from './dto/simulate-payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly payments: PaymentsService) {}

  /** GET /payments — list payments (filter by clientId) */
  @Get()
  @ApiOperation({ summary: 'List payments (filter by clientId)' })
  @ApiQuery({ name: 'clientId', required: false, description: 'Filter by client UUID' })
  @ApiOkResponse({ description: 'List of payments' })
  async findAll(@Query('clientId') clientId?: string) {
    const data = await this.payments.findAll(clientId);
    return { success: true, count: data.length, data };
  }

  /** GET /payments/order/:orderId — the payment for a given order */
  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get the payment associated with an order' })
  @ApiOkResponse({ description: 'Payment found' })
  @ApiNotFoundResponse({ description: 'No payment for this order' })
  async findByOrder(@Param('orderId') orderId: string) {
    const data = await this.payments.findByOrder(orderId);
    return { success: true, data };
  }

  /**
   * POST /payments/webhook — provider callback (Stripe-style).
   * Verifies the `stripe-signature` header against the raw request body.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment provider webhook (signature-verified)' })
  @ApiHeader({ name: 'stripe-signature', description: 'HMAC signature (t=…,v1=…)', required: true })
  @ApiOkResponse({ description: 'Webhook processed' })
  @ApiBadRequestResponse({ description: 'Invalid signature or payload' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body for signature verification');
    }
    const payment = await this.payments.processWebhook(rawBody, signature);
    return { received: true, paymentId: payment.id, status: payment.status };
  }

  /**
   * POST /payments/:id/pay — DEMO ONLY: simulate the client completing payment.
   * Internally builds a signed webhook and runs the real verification path.
   */
  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[demo] Simulate the client paying (success|fail)' })
  @ApiCreatedResponse({ description: 'Payment processed' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  async pay(@Param('id') id: string, @Body() dto: SimulatePaymentDto) {
    this.logger.log(`POST /payments/${id}/pay outcome=${dto.outcome ?? 'success'}`);
    const payment = await this.payments.simulateClientPayment(id, dto.outcome ?? 'success');
    return { success: true, data: payment };
  }
}
