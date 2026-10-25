import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Rutas bajo el prefijo global `api`: /api/docs (UI) y /api/docs-json. */
export const RUTA_DOCS = 'docs';

export function construyeDocumento(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('StockAware ERP API')
    .setDescription('API REST del backend. Los ejemplos son ficticios.')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function montaDocs(app: INestApplication): void {
  SwaggerModule.setup(RUTA_DOCS, app, construyeDocumento(app), {
    useGlobalPrefix: true,
    jsonDocumentUrl: `${RUTA_DOCS}-json`,
  });
}
