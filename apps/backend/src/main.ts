import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function arranca() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  const puerto = Number(process.env.PUERTO ?? 3000);
  await app.listen(puerto);
  console.log(`Backend ERP escuchando en http://localhost:${puerto}/api`);
}
arranca();
