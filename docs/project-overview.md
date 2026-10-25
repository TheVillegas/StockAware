# StockAware: contexto del proyecto

## Problema y propósito

Las compras de productos MRO —equipos de protección personal, ropa técnica, insumos y herramientas— pueden registrar un mismo producto con descripciones distintas. Esa variación dificulta consolidar el consumo, comparar precios y decidir qué reponer. StockAware busca apoyar esas decisiones con información de inventario y recomendaciones explicables.

## Usuarios previstos

El sistema está orientado a personal de bodega y adquisiciones, supervisores de terreno y prevención de riesgos, y administradores. La réplica funcional actual incluye perfiles de acceso del ERP VAIPS; esos perfiles no significan que cada flujo de negocio previsto esté implementado.

## Alcance previsto y límites actuales

Como objetivo de producto, StockAware contempla normalizar descripciones, registrar movimientos y conteos, y priorizar reposiciones considerando consumo, cobertura, criticidad, contexto y precios de referencia. Las recomendaciones deberían explicar sus factores y permitir que una persona las confirme o ajuste; la disponibilidad de EPP crítico es una restricción de seguridad, no un criterio sacrificable por ahorro.

Esto describe la intención del producto, no una afirmación de que todas esas capacidades estén disponibles hoy. La EP2 incorpora a la réplica la consulta operativa de precios de mercado, su procesamiento y persistencia, y un panel para revisión humana. Las reglas actuales de Stock usan existencias y consumo para presentar urgencia, cobertura y cantidades sugeridas; no constituyen el futuro motor adaptativo que combine contexto y precios externos.

## Arquitectura y tecnologías

### Implementado en la réplica actual

La aplicación ejecutable incluye frontend Angular + Ionic, API principal NestJS, servicio Python + FastAPI, PostgreSQL y Docker Compose. El frontend accede a NestJS, que concentra autenticación, autorización y persistencia con TypeORM. Para los precios de mercado:

1. NestJS recupera contenido de las fuentes elegibles cuando sus datos vencen.
2. FastAPI recibe ese contenido, lo parsea, normaliza y propone candidatos; no consulta las fuentes ni escribe en la base.
3. NestJS valida y guarda publicaciones, observaciones y vínculos en `precios_externos`, sin modificar el esquema de la réplica.
4. El panel **Precios de mercado** de Stock muestra fuente, fechas, disponibilidad y estado; una persona con permiso puede confirmar o rechazar vínculos.

La vigencia base es una semana. Ante una falla se muestra lo guardado como desactualizado; si no existen datos para responder, se informa el error sin inventar precios. Los contratos y matices por fuente están en el [ADR 0002](architecture/adr/0002-precios-de-mercado-externos.md). La [guía EP2](ep2/entrega.md) permite comprobar el recorrido completo; la [guía EP1](ep1/reproducibility.md) conserva la inicialización local de la réplica.

### Arquitectura objetivo

El procesamiento adaptativo futuro debe conservar el límite frontend → NestJS → FastAPI y la decisión final humana. Capacitor/PWA pertenece a la evolución web/móvil, no demuestra por sí mismo una entrega móvil completa. GitHub Actions, controles de calidad/seguridad y OpenAPI ya forman parte del repositorio. El staging actual usa el Blueprint de Render con despliegue automatizado desde Actions; el root Terraform permanece `defined-not-deployed`. La aceptación académica de ese equivalente debe acreditarse por separado, no inferirse del despliegue exitoso.

El backend NestJS de la réplica actual configura TypeORM. La visión objetivo no define una migración a Prisma.

## Reposición adaptativa y fuentes de referencia

Como línea de diseño prevista, el ranking de reposición podría usar cobertura y consumo histórico, tiempos de reposición, criticidad de seguridad, estacionalidad, presupuesto y precios históricos o externos. Las recomendaciones deberían ser explicables y dejar la decisión final bajo intervención humana.

La hipótesis inicial de Mercado Público e IPC no es la integración elegida para EP2. La decisión aceptada de fuentes usa **Dartel, Dimeiggs, SoloTodo, Rhona y Sodimac**. Las tres primeras se consultan por término; Rhona y Sodimac requieren asociar una URL de listado al material. Se respetan robots.txt, presupuestos de tiempo y pausas, sin evadir protecciones.

Los precios son referencias de catálogo, no cotizaciones negociadas ni prueba de equivalencia entre productos. La [medición del 2026-10-24](ep2/metrica/README.md) obtuvo 100 % de registros devueltos válidos y cobertura de 26/32 materiales (81,3 %); no mide precisión semántica del cruce. La [especificación adaptativa preliminar](ep2/especificacion-adaptativa.md) explica cómo podrían aprovecharse esos datos, qué falta validar y cómo evaluar utilidad en la entrega final.
