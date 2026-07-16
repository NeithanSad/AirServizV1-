import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Histogram } from 'prom-client';

// Registered once per process on the default registry.
const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

/** Records latency + status for every HTTP request (rate/latency dashboards). */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = process.hrtime.bigint();
    const record = () => {
      const http = context.switchToHttp();
      const req = http.getRequest();
      const res = http.getResponse();
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ?? req.url ?? 'unknown';
      httpDuration.labels(req.method, route, String(res.statusCode)).observe(seconds);
    };
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
