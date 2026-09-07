import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
<<<<<<< Updated upstream
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { ErroresBdFilter } from './common/errores-bd.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Una violación de restricción es culpa del que llama, no del servidor.
  app.useGlobalFilters(new ErroresBdFilter());

  // Todo lo funcional cuelga de /api; la raíz queda libre para redirigir a la
  // documentación, que es lo que uno espera al abrir el puerto en el navegador.
  app.setGlobalPrefix('api', { exclude: ['/'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // El frontend Angular corre en otro puerto durante el desarrollo.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('StockAware API')
    .setDescription(
      'Réplica de los módulos de Compras (OC → HES) y Bodega del ERP VAIPS.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    customSiteTitle: 'StockAware API',
  });

  const puerto = Number(process.env.BACKEND_PORT ?? 3000);
  await app.listen(puerto, '0.0.0.0');

  console.log(
    [
      '',
      '  StockAware backend en marcha',
      `  Swagger  http://localhost:${puerto}/docs`,
      `  Salud    http://localhost:${puerto}/api/health`,
      '',
    ].join('\n'),
  );
}

await bootstrap();
=======
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
>>>>>>> Stashed changes
