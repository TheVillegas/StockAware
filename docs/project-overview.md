# StockAware: contexto del proyecto

## Problema y propósito

Las compras de productos MRO —equipos de protección personal, ropa técnica, insumos y herramientas— pueden registrar un mismo producto con descripciones distintas. Esa variación dificulta consolidar el consumo, comparar precios y decidir qué reponer. StockAware busca apoyar esas decisiones con información de inventario y recomendaciones explicables.

## Usuarios previstos

El sistema está orientado a personal de bodega y adquisiciones, supervisores de terreno y prevención de riesgos, y administradores. La réplica funcional actual incluye perfiles de acceso del ERP VAIPS; esos perfiles no significan que cada flujo de negocio previsto esté implementado.

## Alcance previsto y límites actuales

Como objetivo de producto, StockAware contempla normalizar descripciones, registrar movimientos y conteos, y priorizar reposiciones considerando consumo, cobertura, criticidad, contexto y precios de referencia. Las recomendaciones deberían explicar sus factores y permitir que una persona las confirme o ajuste; la disponibilidad de EPP crítico es una restricción de seguridad, no un criterio sacrificable por ahorro.

Esto describe la intención del proyecto, no una afirmación de que todas esas capacidades estén disponibles hoy. El alcance actualmente comprobable en la demo es una réplica funcional del ERP VAIPS con datos anonimizados y servicios integrados. No debe interpretarse como un sistema de reposición adaptativa completo ni como una integración operativa con las fuentes externas propuestas.

## Arquitectura y tecnologías

### Implementado en la réplica actual

La aplicación ejecutable incluye frontend Angular + Ionic, API principal NestJS, servicio Python + FastAPI, PostgreSQL y Docker Compose. En la demo, el frontend accede a NestJS; NestJS usa PostgreSQL y puede comunicarse con FastAPI. La guía de [reproducibilidad EP1](ep1/reproducibility.md) describe el recorrido que se puede verificar localmente.

### Arquitectura objetivo

La visión funcional contempla que el frontend se comunique exclusivamente con la API NestJS, que concentraría autenticación, autorización, lógica de negocio y persistencia, además de coordinar procesamiento especializado en FastAPI. La arquitectura de producto considera también Capacitor/PWA para despliegue web y móvil; GitHub Actions para calidad y seguridad; Terraform para definir un ambiente de staging; y OpenAPI/Swagger para contratos y exploración de API. Estos elementos son objetivos o tecnologías contempladas, no necesariamente capacidades desplegadas en la réplica.

El backend NestJS de la réplica actual configura TypeORM. La visión objetivo no define una migración a Prisma.

## Reposición adaptativa y fuentes de referencia

Como línea de diseño prevista, el ranking de reposición podría usar cobertura y consumo histórico, tiempos de reposición, criticidad de seguridad, estacionalidad, presupuesto y precios históricos o externos. Las recomendaciones deberían ser explicables y dejar la decisión final bajo intervención humana.

Se propuso consultar la API pública de Mercado Público (ChileCompra) como fuente de precios y complementar con información del IPC del Instituto Nacional de Estadísticas. Antes de depender de esas fuentes, el proyecto debe validar sus contratos, condiciones de uso, límites de solicitudes y disponibilidad. La propuesta no implica que esas integraciones estén actualmente implementadas.
