import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger as PinoLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  // Global validation pipe — strips unknown fields, transforms types
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // CORS for local development (scope in production via Kong)
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? '*' });

  // OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AirServiz – Booking Service')
    .setDescription('Order management and Kafka event emission')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('orders')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  logger.log(`Booking Service running → http://localhost:${port}`);
  logger.log(`Swagger UI            → http://localhost:${port}/api/docs`);
}

bootstrap();
