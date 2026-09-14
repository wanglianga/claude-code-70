import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));
  await app.listen(8080, '0.0.0.0');
  new Logger('Bootstrap').log('食堂订餐留样与补贴平台 API listening on :8080');
}
bootstrap();
