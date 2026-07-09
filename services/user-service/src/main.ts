import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global validation pipe — strips unknown fields, transforms types
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // CORS for local development (scope in production via Kong)
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? '*' });

  // OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AirServiz – User Service')
    .setDescription('Full user profiles: photo, location, contact info')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('profiles')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  logger.log(`User Service running → http://localhost:${port}`);
  logger.log(`Swagger UI          → http://localhost:${port}/api/docs`);
}

bootstrap();
