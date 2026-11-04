# Cuadrilla

> Evidencia de campo, con o sin señal.

Sistema de gestión de mantenimiento locativo para conjuntos cerrados (piscina, pintura, jardinería y otros). Permite programar semanalmente a ~150 operarios, registrar su jornada (entrada, salida, inicio y fin de cada actividad), capturar evidencia fotográfica (antes, durante, después) y que el supervisor apruebe o rechace el trabajo.

La restricción dominante del proyecto es la conectividad: los operarios usan celulares personales de gama baja-media, sin plan de datos y sin garantía de wifi en el conjunto. Por eso el cliente funciona **offline-first** y sincroniza cuando encuentra red.

Proyecto del taller práctico de Ingeniería de Software Orientado a Objetos (USCO).

## Stack

PERN: PostgreSQL, Express, React y Node.js. Cliente como PWA (instalable, con almacenamiento local en IndexedDB). Migraciones con `node-pg-migrate`, pruebas con Vitest, correo con Nodemailer (Mailpit en local).

## Arquitectura

Monolito modular con arquitectura hexagonal. Una sola aplicación desplegable, dividida por dominio en módulos, y cada módulo dividido en tres capas: dominio, aplicación e infraestructura. La regla que lo sostiene todo es que las dependencias apuntan siempre hacia adentro.

```
        [ HTTP / Express ]   [ Cron / Eventos ]        <- adaptadores de entrada
                  \               /
              [ Casos de uso (application) ]           <- puertos
                          |
                  [ Dominio (domain) ]                 <- reglas de negocio puras
                          |
              [ Puertos de salida (interfaces) ]
                  /       |        \
          [ PostgreSQL ] [ Disco/S3 ] [ SMTP ]         <- adaptadores de salida
```

## Estructura del repositorio

```
cuadrilla/
├── apps/
│   ├── api/                    # Backend Node + Express
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── identity/       # usuarios, roles, login
│   │   │   │   ├── workforce/      # hojas de vida de operarios
│   │   │   │   ├── scheduling/     # programación semanal y envío por correo
│   │   │   │   ├── attendance/     # entrada/salida e inicio/fin de actividad
│   │   │   │   └── evidence/       # fotos y revisión del supervisor
│   │   │   ├── shared/             # utilidades transversales (errores, ids, eventos)
│   │   │   └── main.js             # arranque y composición de dependencias
│   │   ├── migrations/
│   │   └── tests/
│   └── web/                    # React + Vite (PWA)
├── docs/                       # documento de arquitectura y diagramas
├── docker-compose.yml          # PostgreSQL + Mailpit para desarrollo
├── AGENTS.md                   # reglas para asistentes de IA
└── README.md
```

Cada módulo del backend sigue esta forma:

```
modules/scheduling/
├── domain/            # entidades y reglas, sin imports de librerías externas
├── application/       # casos de uso y puertos (interfaces)
├── infrastructure/    # repositorios Postgres, rutas Express, adaptador de correo
└── index.js           # única puerta pública del módulo
```

## Módulos y estado

Para el taller hay que poner en funcionamiento mínimo dos módulos. Los elegidos son `scheduling` y `evidence`, porque cubren los flujos críticos de mayor impacto arquitectónico (programación con correo y sincronización offline de fotos).

| Módulo | Responsable | Estado |
|---|---|---|
| identity | por definir | pendiente |
| workforce | por definir | pendiente |
| scheduling | por definir | pendiente |
| attendance | por definir | pendiente |
| evidence | por definir | pendiente |

## Reparto del equipo

El grupo se divide en tres roles que pueden avanzar en paralelo si respetan el contrato de la API (carpeta `docs/api-contract.md`, se acuerda en la primera sesión).

| Rol | Alcance |
|---|---|
| Arquitectura y documento | Atributos de calidad, limitaciones, casos de uso, escenarios críticos, estilo arquitectónico, decisiones críticas e integración del documento final. Vive en `docs/`. |
| Backend y datos | `apps/api`, base de datos, diagrama de componentes y ER, módulos de hojas de vida y programación. |
| Móvil y sincronización | `apps/web`, PWA, cola de subida offline, vista de supervisor en tablet, diagrama de despliegue. |

## Puesta en marcha

Requisitos: Node 20 o superior, Docker Desktop y Git.

```bash
git clone <URL-DEL-REPO>
cd cuadrilla

# 1. Levantar PostgreSQL y Mailpit
docker compose up -d

# 2. Backend
cd apps/api
cp .env.example .env
npm install
npm run migrate:up
npm run dev          # http://localhost:3000

# 3. Frontend (en otra terminal)
cd apps/web
npm install
npm run dev          # http://localhost:5173
```

Los correos enviados en desarrollo se ven en http://localhost:8025 (Mailpit), sin enviar nada real.

Variables de entorno principales del backend: `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `UPLOADS_DIR`.

## Guía de Git para el equipo

Si es tu primera vez con Git y GitHub, esta sección es la única que necesitas. La idea central es simple: **nadie trabaja directamente en `main`**. Cada tarea se hace en una rama propia, se sube y se une a `main` mediante un Pull Request que otro compañero revisa.

### Flujo diario

```bash
# 1. Antes de empezar, trae lo último de main
git checkout main
git pull

# 2. Crea tu rama para la tarea (un nombre corto que diga qué haces)
git checkout -b feature/scheduling-crear-programacion

# 3. Trabaja, y cada vez que algo funcione, guarda un punto de control
git add .
git commit -m "feat(scheduling): crear programación semanal"

# 4. Sube tu rama a GitHub
git push -u origin feature/scheduling-crear-programacion
```

Después, en GitHub aparece un botón verde para abrir un **Pull Request**. Se pide revisión a un compañero y, cuando lo aprueba, se pulsa "Merge". Luego se vuelve al paso 1.

### Reglas que evitan casi todos los problemas

Haz commits pequeños y frecuentes, mejor diez commits chicos que uno gigante al final del día. Haz `git pull` sobre `main` antes de crear cada rama nueva. No subas nunca el archivo `.env`, ni la carpeta `node_modules`, ni fotos de prueba pesadas (el `.gitignore` ya los excluye, no lo modifiques sin avisar). Si algo sale raro, no borres la carpeta ni cloneas de nuevo: escribe al grupo con el mensaje de error, casi siempre tiene arreglo.

### Nombres de ramas y commits

Las ramas llevan prefijo: `feature/` para funcionalidad nueva, `fix/` para corregir errores y `docs/` para documentación. Los mensajes de commit siguen el formato `tipo(módulo): descripción`, con tipos `feat`, `fix`, `docs`, `refactor` y `test`. Ejemplo: `fix(evidence): evitar subida duplicada de foto`.

### Si aparece un conflicto

Un conflicto significa que dos personas tocaron las mismas líneas. Git marca el archivo con `<<<<<<<`, `=======` y `>>>>>>>`. Abre el archivo, decide qué versión (o mezcla) se queda, borra esas marcas, y luego:

```bash
git add <archivo>
git commit
```

Si no está claro cuál versión conservar, se decide entre los dos autores antes de tocar nada.

## Comandos útiles

```bash
npm run dev           # arrancar en modo desarrollo
npm test              # correr pruebas
npm run migrate:up    # aplicar migraciones pendientes
npm run migrate:down  # revertir la última migración
npm run lint          # revisar estilo de código
```

## Licencia

Uso académico.
