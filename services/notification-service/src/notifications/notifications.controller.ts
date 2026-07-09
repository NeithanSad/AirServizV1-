import {
  Controller,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Response } from 'express';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /**
   * GET /notifications
   * Returns the in-memory history of consumed events (newest first, max 200).
   */
  @Get()
  @ApiOperation({ summary: 'List all consumed events (newest first)' })
  findAll() {
    return { success: true, count: this.svc.findAll().length, data: this.svc.findAll() };
  }

  /**
   * GET /notifications/stream
   * Server-Sent Events stream — pushes a new event to the client
   * every time a Kafka message is consumed.
   *
   * EventSource format:
   *   event: message
   *   data: { ...NotificationRecord }
   */
  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream — real-time consumed events' })
  stream(@Res() res: Response): Observable<MessageEvent> {
    // Ensure SSE headers are not cached
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    return this.svc.stream();
  }

  /**
   * DELETE /notifications
   * Clears the in-memory history (dev/test utility).
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear notification history (dev only)' })
  clear(): void {
    this.svc.clear();
  }
}
