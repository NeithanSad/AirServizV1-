import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger as PinoLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: '*' });

  const swagger = new DocumentBuilder()
    .setTitle('AirServiz – Auth Service')
    .setDescription('User registration, login and JWT management')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Auth Service running → http://localhost:${port}`);
  logger.log(`Swagger UI          → http://localhost:${port}/api/docs`);
}

bootstrap();
