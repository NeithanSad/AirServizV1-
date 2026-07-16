import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { collectDefaultMetrics } from 'prom-client';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

// Process/runtime metrics (CPU, memory, event-loop lag, GC) on the default
// registry. Imported once via AppModule, so this runs a single time.
collectDefaultMetrics();

@Module({
  controllers: [MetricsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class MetricsModule {}
