# StockAware

Aplicación web multiplataforma para consolidar un inventario MRO con descripciones heterogéneas y generar recomendaciones explicables de reposición. El proyecto se desarrolla para la asignatura **Ingeniería Web Avanzada** de la Pontificia Universidad Católica de Valparaíso.

> **Estado actual:** estructura inicial del repositorio. Los componentes todavía no han sido generados ni configurados.

## Contribución y flujo Git

La guía completa para contribuir está en [CONTRIBUTING.md](CONTRIBUTING.md). En resumen, `develop` es la rama de integración y `main` contiene el estado estable. El trabajo diario se realiza en ramas cortas `feat/*`, `fix/*`, `docs/*`, `chore/*`, `refactor/*`, `test/*` o `ci/*`, que abren pull requests hacia `develop`. Las releases pasan de `develop` a `main`; los hotfixes parten de `main`, se integran allí y luego se sincronizan con `develop`.

## Problema abordado

Las compras de productos MRO —equipos de protección personal, ropa técnica, insumos y herramientas— suelen registrarse con nombres distintos para un mismo producto. Esto impide conocer correctamente el consumo, comparar precios y decidir qué artículos deben reponerse primero.

StockAware busca:

- normalizar y consolidar descripciones equivalentes;
- registrar movimientos y conteos de inventario;
- obtener precios de referencia desde fuentes web públicas;
- priorizar la reposición según consumo, cobertura, criticidad y contexto;
- explicar las recomendaciones y permitir que el usuario las confirme o ajuste.

## Usuarios objetivo

- personal de bodega;
- personal de adquisiciones;
- supervisores de terreno y prevención de riesgos;
- administradores del sistema.

## Arquitectura prevista

```text
Angular + Ionic + Capacitor
            |
            v
     NestJS REST API
       /          \
      v            v
PostgreSQL   Python + FastAPI
                    |
                    v
       Mercado Público + INE
```

El frontend se comunicará exclusivamente con la API principal de NestJS. NestJS administrará la lógica de negocio, autenticación, autorización y persistencia, además de coordinar el procesamiento especializado proporcionado por FastAPI.

## Tecnologías requeridas

| Área | Tecnología | Propósito |
|---|---|---|
| Frontend | Angular y TypeScript | Aplicación web principal |
| Interfaz | Ionic Framework | Componentes adaptados a web y dispositivos móviles |
| Integración móvil | Capacitor | Compilación Android y acceso a capacidades del dispositivo |
| Aplicación web | PWA | Instalación y funcionamiento parcial sin conexión |
| Backend principal | NestJS y Node.js | API REST, autenticación y lógica de negocio |
| Servicio especializado | Python y FastAPI | Normalización, clasificación y priorización |
| Base de datos | PostgreSQL | Persistencia relacional principal |
| Contenedores | Docker y Docker Compose | Ejecución reproducible de los servicios |
| Integración continua | GitHub Actions | Pruebas, seguridad, construcción y despliegue |
| Infraestructura | Terraform | Definición reproducible del ambiente de staging |
| Documentación de API | OpenAPI y Swagger | Contratos y exploración de endpoints |

La selección entre **Prisma** y **TypeORM** todavía está pendiente y deberá registrarse mediante una decisión arquitectónica.

## Estructura inicial

```text
StockAware/
├── .github/
│   └── workflows/              # Pipeline DevSecOps con GitHub Actions
├── apps/
│   ├── frontend/               # Angular, Ionic, Capacitor y PWA
│   ├── backend/                # API principal NestJS
│   └── intelligence-service/   # Servicio Python y FastAPI
├── infrastructure/
│   └── terraform/              # Infraestructura como código
├── docs/
│   ├── architecture/           # Diagramas y documentación arquitectónica
│   │   └── adr/                # Registros de decisiones arquitectónicas
│   └── database/               # Modelos y diagramas de datos
├── tests/
│   └── integration/            # Pruebas de integración entre componentes
└── README.md
```

Las carpetas incluyen archivos `.gitkeep` temporales para que Git pueda versionarlas mientras permanezcan vacías. Estos archivos deberán eliminarse cuando se agregue contenido real.

## Fuente de información web

La fuente principal propuesta es la API pública de **Mercado Público (ChileCompra)**, complementada con información del IPC publicada por el **Instituto Nacional de Estadísticas**. Se deberán validar previamente sus contratos, condiciones de uso, límites de solicitudes y disponibilidad.

## Capacidad adaptativa

El sistema clasificará los productos en familias de reposición y generará un ranking semanal mediante variables como:

- cobertura y consumo histórico;
- tiempo de reposición;
- criticidad de seguridad;
- estacionalidad;
- presupuesto disponible;
- precio histórico y precio externo de referencia.

Cada recomendación deberá ser explicable y permitir intervención humana. La disponibilidad de EPP crítico será una restricción de seguridad, no un criterio sacrificable por ahorro.

## Plan inicial de trabajo

### 1. Fundaciones del repositorio

- [x] Crear la estructura inicial.
- [x] Documentar la arquitectura y tecnologías previstas.
- [x] Inicializar Git local con las ramas base `main` y `develop`.
- [ ] Publicar el repositorio en GitHub.
- [x] Incorporar `.gitignore`, `.editorconfig` y archivos de contribución.
- [x] Definir estrategia de ramas, commits, issues y pull requests.

### 2. Componentes base

- [ ] Generar el frontend con Ionic y Angular.
- [ ] Configurar Capacitor y PWA.
- [ ] Generar el backend NestJS.
- [ ] Crear el servicio Python con FastAPI.
- [ ] Configurar PostgreSQL y las migraciones iniciales.

### 3. Integración local

- [ ] Crear un Dockerfile para cada componente.
- [ ] Incorporar PostgreSQL a Docker Compose.
- [ ] Verificar el flujo Angular → NestJS → FastAPI.
- [ ] Verificar la conexión NestJS → PostgreSQL.
- [ ] Implementar endpoints de salud.

### 4. Calidad y DevSecOps

- [ ] Configurar linting y pruebas para cada componente.
- [ ] Incorporar análisis estático y de dependencias.
- [ ] Configurar detección de secretos.
- [ ] Construir y analizar las imágenes Docker.
- [ ] Configurar quality gates en GitHub Actions.

### 5. Infraestructura y staging

- [ ] Definir proveedor y recursos mediante Terraform.
- [ ] Validar `terraform fmt`, `terraform validate` y `terraform plan`.
- [ ] Configurar el ambiente de staging.
- [ ] Automatizar despliegue, health checks y rollback básico.

## Equipo y responsabilidades

| Integrante | Responsabilidades principales |
|---|---|
| Matías Romero | Backend NestJS, PostgreSQL, seguridad y control de acceso |
| Matías Villegas | Angular/Ionic, FastAPI, capacidad adaptativa y DevSecOps |

Las pruebas de integración, la documentación y las decisiones arquitectónicas serán responsabilidad compartida.

## Variables y secretos

El repositorio deberá incluir archivos `.env.example` con valores ficticios. Los archivos `.env`, credenciales, certificados, claves privadas y datos comerciales reales **no deben versionarse**.

- Las configuraciones no sensibles se almacenarán como **GitHub Actions Variables**.
- Las contraseñas, tokens y claves se almacenarán como **GitHub Actions Secrets**.
- Los datos históricos utilizados para pruebas deberán estar anonimizados.

## Documentación prevista

- diagramas de contexto, contenedores y despliegue;
- modelo conceptual y lógico de la base de datos;
- decisiones arquitectónicas en formato ADR;
- documentación OpenAPI de NestJS y FastAPI;
- instrucciones de instalación, pruebas y despliegue;
- estrategia de seguridad, privacidad y observabilidad;
- enlaces al prototipo Figma, tablero de trabajo y ambiente de staging.

## Enlaces

| Recurso | Estado |
|---|---|
| Repositorio GitHub | Pendiente |
| Tablero de gestión | Pendiente |
| Prototipo Figma | Pendiente |
| Ambiente de staging | Pendiente |
| Documentación de API | Pendiente |

## Licencia

Pendiente de definición por el equipo.
