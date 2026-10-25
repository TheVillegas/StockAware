# Diagramas de arquitectura EP1

Estos diagramas describen la réplica que hoy se puede ejecutar, no un producto terminado de reposición adaptativa. El [contexto del proyecto](../project-overview.md) separa esa visión del alcance comprobable. La [guía de reproducibilidad](../ep1/reproducibility.md) detalla puertos, orden de arranque y pruebas locales. No hay enlace de Figma en este documento: todavía no se proporcionó una URL.

## Contexto

StockAware, en la forma que corre ahora, lo usan personas de bodega y adquisiciones, supervisores y administradores. Lo que está en ejecución es una réplica anonimizada del ERP VAIPS. Los perfiles de acceso de esa réplica no significan que cada flujo previsto del producto ya esté implementado.

Mercado Público e INE IPC aparecen solo como fuentes externas propuestas. No están integradas: el diagrama no dibuja una relación con ellas.

```mermaid
flowchart TB
  subgraph personas [Personas que usan StockAware]
    bodega["Personal de bodega y adquisiciones"]
    supervision["Supervisores"]
    administracion["Administradores"]
  end

  replica["StockAware en ejecución: réplica anonimizada del ERP VAIPS"]

  subgraph propuestas [Fuentes propuestas, sin integración]
    mercadopublico["Mercado Público"]
    ine["INE IPC"]
  end

  bodega --> replica
  supervision --> replica
  administracion --> replica
```

No hay flecha desde Mercado Público ni desde INE IPC hacia la réplica. Esa ausencia es intencional.

## Contenedores

El diagrama sigue `docker-compose.yml`. Los puertos de host son los defaults del Compose (`4200`, `3000`, `8000` y `5432`); se pueden cambiar con variables de entorno. El navegador carga la interfaz desde `erp-frontend` y la aplicación Angular + Ionic llama solo a NestJS (`http://localhost:3000/api` en el código del frontend). No hay canal de la aplicación hacia FastAPI ni hacia PostgreSQL.

Compose publica los puertos de FastAPI y PostgreSQL en el host para pruebas locales. Eso no es una dependencia del navegador. El backend, dentro de la red de Compose, usa `http://intelligence:8000`.

`erp-backend` espera a que `db` e `intelligence` estén healthy antes de iniciar. `erp-frontend` declara `depends_on` de `backend`; eso es orden de arranque, no un proxy. `erp-intelligence` expone `GET /health`. `erp-db` usa la imagen `postgres:16-alpine`, la base por defecto `erp_replica` y el volumen `pgdata`. NestJS y el frontend no declaran healthcheck en Compose.

```mermaid
flowchart LR
  navegador["Navegador"]
  frontend["erp-frontend<br/>Angular + Ionic<br/>host 4200 hacia puerto 80"]
  backend["erp-backend<br/>NestJS<br/>host 3000"]
  intelligence["erp-intelligence<br/>FastAPI<br/>host 8000<br/>GET /health"]
  db["erp-db<br/>postgres:16-alpine<br/>host 5432<br/>base erp_replica<br/>volumen pgdata"]

  navegador -->|"carga la interfaz"| frontend
  navegador -->|"API solo hacia NestJS"| backend
  backend -->|"http://intelligence:8000"| intelligence
  backend -->|"PostgreSQL en la red Compose"| db
```

## Despliegue preliminar

Hoy el único entorno que se ejecuta es un host de desarrollo que corre Docker Compose con los cuatro contenedores anteriores. Staging está definido en Terraform y no está desplegado. No hay cuenta cloud, balanceador ni URL pública que este repositorio pueda mostrar.

```mermaid
flowchart TB
  host["Un host de desarrollo"]
  compose["Docker Compose<br/>erp-frontend, erp-backend, erp-intelligence, erp-db"]
  ausente["Staging definido, no desplegado<br/>sin cuenta cloud ni URL pública"]

  host --> compose
```

`ausente` queda sin flecha a propósito: no representa un ambiente creado.
