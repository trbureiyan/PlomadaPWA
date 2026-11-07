# Plomada

Sistema web para el control de mantenimiento locativo en conjuntos cerrados: programación semanal de operarios, registro de jornada y evidencia fotográfica con revisión del supervisor, diseñado para funcionar sin conexión estable. Proyecto del taller práctico de Ingeniería de Software Orientado a Objetos (USCO).

La plomada es la herramienta con la que un oficial de obra verifica que un muro quedó a nivel. Aquí cumple la misma función: el supervisor contrasta el trabajo contra la evidencia.

# Integrantes

- [Brayan Toro Bustos](https://github.com/trbureiyan): A, arquitectura, contrato e integración
- Juan Camilo Mora Castañeda: B, backend y datos
- [Pablo Trujillo Artunduaga](https://github.com/PabloTrujilloArtunduaga): C, cliente móvil y sincronización

## Estado

El sistema está integrado en la rama `integracion`: el backend con sus seis módulos, el cliente PWA con la cola de sincronización y el panel de los cuatro roles. El recorrido en línea (inicio de sesión, programar, publicar con correo, jornada, fotos, revisión y seguimiento) funciona de punta a punta según la prueba de ejecución del QA del 2026-11-06. Lo que falla está en los bordes del trabajo sin conexión, en la seguridad y en la coherencia entre módulos, y está recogido con su responsable y su criterio de aceptación en `docs/plan-de-correcciones.md`. Mientras ese plan esté abierto, ninguna rama se une a `main` salvo el PR final de `integracion`.

Para empezar, cada integrante lee `docs/plan-de-trabajo.md` (sus tareas están numeradas), `docs/contrato-api.md` y `docs/decisiones/README.md`, donde están las decisiones que le tocan con un valor por defecto.

## Decisiones ya tomadas

El stack es PERN con TypeScript en modo estricto en todo el código y pnpm como gestor de paquetes, organizado como un workspace con tres paquetes: `backend`, `frontend` y `shared`. El paquete `shared` contiene los esquemas y tipos del contrato de la API, de modo que si B cambia un campo, el frontend de C deja de compilar en lugar de fallar durante la integración.

El backend es un monolito modular con arquitectura hexagonal: cada módulo separa dominio, casos de uso y adaptadores, los puertos son interfaces de TypeScript y un módulo solo se comunica con otros a través de su interfaz pública. El cliente es una PWA que guarda todo localmente en IndexedDB y sincroniza con una cola cuando hay conexión, porque los operarios no tienen datos móviles y el conjunto no garantiza internet. Las fotos se guardan en disco local y el correo sale por SMTP, ambos detrás de un puerto para poder cambiarlos sin tocar el dominio. El despliegue es local, con Docker Compose solo para PostgreSQL y el servidor de correo de pruebas. La justificación completa de cada decisión vive en `docs/arquitectura.md` y en `docs/decisiones/`.

## Estructura

```
plomada/
  README.md
  AGENTS.md
  package.json              scripts de la raíz y versión de pnpm fijada
  pnpm-workspace.yaml
  tsconfig.base.json        configuración estricta compartida
  docker-compose.yml        PostgreSQL y Mailpit
  .github/workflows/        CI: typecheck y pruebas en cada PR
  docker/postgres/init/     crea la base de pruebas
  docs/
    arquitectura.md         documento del taller (ítems 1 a 11)
    plan-de-trabajo.md      tareas por rol y puntos de integración
    plan-de-correcciones.md correcciones tras la prueba de ejecución, por rol
    plan-de-cierre.md       fase final: orden, ensayo y qué cubre quién
    demostracion.md         guion de la demostración y lista de comprobación del ensayo
    contrato-api.md         endpoints, entradas y salidas, explicados
    glosario.md             entidades y vocabulario común
    decisiones/             una nota por decisión crítica
    diagramas/              fuentes D2 y sus SVG, con guía de estilo
    pdf/                    generador del PDF del documento
    referencias/            enunciado del taller y ejemplo de SAD del curso
  shared/
    src/                    esquemas y tipos del contrato de la API
  backend/
    src/
      modules/
        identidad/          usuarios, roles, autenticación
        personal/           hojas de vida de operarios
        programacion/       centros de trabajo, actividades, programación semanal
        jornada/            entrada y salida del centro, inicio y fin de actividad
        evidencias/         fotos antes, durante y después; revisión del supervisor
        seguimiento/        vista en tiempo real, solo lectura
      composition-root.ts   único lugar donde se conectan puertos y adaptadores
    db/migrations/
  frontend/                 PWA de operarios y vista de supervisor
```

Cada módulo del backend tiene la misma forma interna: `domain/`, `application/` (con `ports/`) e `infrastructure/` (con `http/`, `persistence/` y los adaptadores que necesite). Para la sustentación se ponen en funcionamiento `programacion` y `evidencias`, sobre una versión mínima de `identidad`.

## Puesta en marcha

Requisitos: Node.js 22 o superior, Docker con Compose y Git. El repositorio fija la versión de pnpm, así que basta con activar Corepack una sola vez y no hace falta instalar pnpm aparte.

```bash
corepack enable                       # una sola vez por máquina

docker compose up -d                  # PostgreSQL y Mailpit

pnpm install                          # desde la raíz; instala los tres paquetes

cp backend/.env.example backend/.env  # si tu PostgreSQL local ya usa el 5432, ver docker-compose.yml
pnpm --filter backend migrate
pnpm --filter backend dev             # API en http://localhost:3000

# en otra terminal
pnpm --filter frontend dev            # PWA en http://localhost:5173
```

Mailpit recibe los correos de prueba y los muestra en http://localhost:8025, así que ninguna programación semanal sale a un correo real durante el desarrollo. Desde la raíz, `pnpm -r typecheck` revisa los tipos de todos los paquetes y `pnpm -r test` corre todas las pruebas. El backend corre directamente con `tsx`, sin paso de compilación, porque el despliegue es local.

## Entorno sin Docker

Para quien no use Docker, los mismos servicios se arman a mano.

PostgreSQL 17 nativo, con un rol y dos bases (la de pruebas la truncan los tests, nunca apuntes a ella datos que quieras conservar):

```bash
psql -U postgres -c "CREATE ROLE plomada LOGIN PASSWORD 'plomada'"
psql -U postgres -c "CREATE DATABASE plomada OWNER plomada"
psql -U postgres -c "CREATE DATABASE plomada_test OWNER plomada"
```

Mailpit como ejecutable, descargado de https://github.com/axllent/mailpit/releases: se arranca con `mailpit` y escucha SMTP en el 1025 y la interfaz en http://localhost:8025.

Las pruebas del backend usan `postgres://plomada:plomada@localhost:5432/plomada_test` si `DATABASE_URL_TEST` no está definida, migran esa base solas y la siembran al empezar cada suite HTTP. Si tu PostgreSQL escucha en otro puerto, exporta `DATABASE_URL_TEST` (o `POSTGRES_PORT` si usas el compose). Con la base en marcha, `pnpm --filter @plomada/backend test` basta, sin `.env` ni variables.

## Quién toca qué

Para que los tres trabajen en paralelo sin pisarse, cada carpeta tiene un dueño. Editar una carpeta ajena se avisa antes.

| Carpeta | Dueño | Responsabilidad |
|---|---|---|
| `docs/` salvo los ítems 6 a 9, `shared/`, raíz, `docker-compose.yml`, `.github/` | A (Brayan) | Arquitectura, contrato, decisiones, integración final |
| `backend/` | B (Juan Camilo) | Módulos, base de datos, migraciones, API |
| `backend/src/modules/programacion/infrastructure/mail/` | C (Pablo) | Adaptador de correo de la programación semanal |
| `frontend/` | C (Pablo) | PWA, almacenamiento local, sincronización, vista del supervisor |

El contrato de la API, que son `docs/contrato-api.md` y los tipos de `shared/`, es lo que permite el trabajo paralelo: B lo implementa, C lo consume con datos simulados hasta que el backend responda. Cambiarlo requiere un PR propio aprobado por A, y los dos archivos cambian juntos.

## Trabajo con Git

La regla central es que nadie escribe directamente en `main`. Cada tarea vive en su propia rama, se sube a GitHub y se une a `main` mediante un Pull Request que revisa A. Durante el plan de correcciones, el Pull Request de cada tarea va hacia `integracion` y no hacia `main`; A abre un único PR de `integracion` a `main` al final. Así un error de uno nunca rompe lo de los otros.

Primera vez:

```bash
git clone <url-del-repo>
cd plomada
corepack enable
pnpm install
```

Cada tarea nueva:

```bash
git switch main
git pull                              # trae lo último de los demás
pnpm install                          # solo hace falta si cambió pnpm-lock.yaml, no estorba si no
git switch -c feat/backend-programacion   # rama nueva, nombre: tipo/area-tarea

# ...trabajar...

pnpm -r typecheck && pnpm -r test     # antes de subir, que ambos pasen
git status                            # ver qué cambió
git add .
git commit -m "feat(programacion): crea la programación semanal"
git push -u origin feat/backend-programacion
```

Después se abre el Pull Request desde GitHub (aparece un botón al hacer push), se espera la revisión y se une con "Squash and merge". Al terminar, de vuelta en la terminal:

```bash
git switch main
git pull
git branch -d feat/backend-programacion
```

Los tipos de rama y de commit son `feat` (algo nuevo), `fix` (corrección), `docs` (documentación) y `refactor` (reordenar sin cambiar comportamiento). El mensaje del commit dice qué hace el cambio, en una línea.

Cuatro reglas para no perder trabajo: hacer `git pull` antes de empezar cada tarea, hacer commits pequeños y frecuentes, no resolver un conflicto a ciegas y usar solo pnpm, nunca `npm install`, porque crea un segundo archivo de dependencias que choca con el del repositorio. Si Git avisa de un conflicto, se detiene todo y se le pregunta a A. Nunca se sube el archivo `.env`, la carpeta `node_modules` ni fotos de prueba; `.gitignore` ya los excluye. El archivo `pnpm-lock.yaml` sí se sube y no se edita a mano.

## Documentación

La fuente de verdad del diseño es `docs/arquitectura.md`, escrito en el formato de documento de arquitectura (SAD) del curso. Los diagramas se escriben en D2 dentro de `docs/diagramas/` (la guía está en su README) y el PDF que se entrega se genera con `pnpm --filter @plomada/docs pdf`, que usa el Chrome o el Edge instalado y lo deja en `docs/pdf/salida/`. Las decisiones críticas se registran una por archivo en `docs/decisiones/`, con el formato que pide el taller: problema encontrado, opciones evaluadas y opción seleccionada con su razón.
