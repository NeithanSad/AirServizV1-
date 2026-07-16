import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

/** Prometheus scrape endpoint — GET /metrics (plain text exposition format) */
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  metrics(): Promise<string> {
    return register.metrics();
  }
}
