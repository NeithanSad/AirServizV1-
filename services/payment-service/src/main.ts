import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody:true keeps the raw request buffer available for webhook
  // signature verification (Stripe-style), alongside the parsed JSON body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  app.enableCors({ origin: process.env.CORS_ORIGIN ?? '*' });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AirServiz – Payment Service')
    .setDescription('Processes payments for confirmed orders and emits payment_processed')
    .setVersion('1.0')
    .addTag('payments')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3006;
  await app.listen(port);
  logger.log(`Payment Service running → http://localhost:${port}`);
  logger.log(`Swagger UI            → http://localhost:${port}/api/docs`);
}

bootstrap();
