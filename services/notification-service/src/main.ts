import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.enableCors({ origin: '*' });

  const swagger = new DocumentBuilder()
    .setTitle('AirServiz – Notification Service')
    .setDescription('Kafka consumer + SSE event broadcaster')
    .setVersion('1.0')
    .addTag('notifications')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  logger.log(`Notification Service running → http://localhost:${port}`);
  logger.log(`SSE stream              → http://localhost:${port}/notifications/stream`);
  logger.log(`Swagger UI              → http://localhost:${port}/api/docs`);
}

bootstrap();
