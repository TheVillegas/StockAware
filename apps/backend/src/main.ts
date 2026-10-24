import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { montaDocs } from './documentacion/documentacion';

async function arranca() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  montaDocs(app);
  const puerto = Number(process.env.PUERTO ?? 3000);
  await app.listen(puerto);
  console.log(`Backend ERP escuchando en http://localhost:${puerto}/api`);
  console.log(`Documentacion OpenAPI en http://localhost:${puerto}/api/docs`);
}
arranca();
