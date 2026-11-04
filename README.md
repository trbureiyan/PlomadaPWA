# Plomada

Sistema web para el control de mantenimiento locativo en conjuntos cerrados: programación semanal de operarios, registro de jornada y evidencia fotográfica con revisión del supervisor, diseñado para funcionar sin conexión estable. Proyecto del taller práctico de Ingeniería de Software Orientado a Objetos (USCO).

La plomada es la herramienta con la que un oficial de obra verifica que un muro quedó a nivel. Aquí cumple la misma función: el supervisor contrasta el trabajo contra la evidencia.

# Integrantes

- [Pablo Trujillo Artunduaga](https://github.com/PabloTrujilloArtunduaga)
- [Brayan Toro Bustos](https://github.com/trbureiyan)
- Juan Camilo Mora Castañeda

## Estado

El repositorio contiene por ahora solo documentación base. Las carpetas `backend/` y `frontend/` se crean al empezar a codificar. Los comandos de la sección de puesta en marcha son el contrato de scripts que cada carpeta debe cumplir cuando exista.

## Decisiones ya tomadas

El stack es PERN: PostgreSQL, Express, React y Node. El backend es un monolito modular con arquitectura hexagonal: cada módulo separa dominio, casos de uso y adaptadores, y solo se comunica con otros a través de su interfaz pública. El cliente es una PWA que guarda todo localmente en IndexedDB y sincroniza con una cola cuando hay conexión, porque los operarios no tienen datos móviles y el conjunto no garantiza internet. Las fotos se guardan en disco local y el correo sale por SMTP, ambos detrás de un puerto para poder cambiarlos sin tocar el dominio. El despliegue es local, con Docker Compose solo para PostgreSQL y el servidor de correo de pruebas. La justificación completa de cada decisión vive en `docs/arquitectura.md` y en `docs/decisiones/`.

## Estructura

```
plomada/
  README.md
  AGENTS.md
  docker-compose.yml        PostgreSQL y Mailpit
  docs/
    arquitectura.md         documento del taller (ítems 1 a 11)
    contrato-api.md         endpoints, entradas y salidas
    glosario.md             entidades y vocabulario común
    decisiones/             una nota por decisión crítica
  backend/
    src/
      modules/
        identidad/          usuarios, roles, autenticación
        personal/           hojas de vida de operarios
        programacion/       centros de trabajo, actividades, programación semanal
        jornada/            entrada y salida del centro, inicio y fin de actividad
        evidencias/         fotos antes, durante y después; revisión del supervisor
        seguimiento/        vista en tiempo real, solo lectura
      composition-root.js   único lugar donde se conectan puertos y adaptadores
    db/migrations/
  frontend/                 PWA de operarios y vista de supervisor
```

Cada módulo del backend tiene la misma forma interna: `domain/`, `application/` (con `ports/`) e `infrastructure/` (con `http/`, `persistence/` y los adaptadores que necesite). Para la sustentación se ponen en funcionamiento `programacion` y `evidencias`, sobre una versión mínima de `identidad`.

## Puesta en marcha

Requisitos: Node.js 22 o superior, Docker con Compose y Git.

```bash
# dependencias externas (PostgreSQL y Mailpit)
docker compose up -d

# backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev          # API en http://localhost:3000

# frontend, en otra terminal
cd frontend
npm install
npm run dev          # PWA en http://localhost:5173
```

Mailpit recibe los correos de prueba y los muestra en http://localhost:8025, así que ninguna programación semanal sale a un correo real durante el desarrollo. Las pruebas se corren con `npm test` dentro de cada carpeta.

## Quién toca qué

Para que los tres trabajen en paralelo sin pisarse, cada carpeta tiene un dueño. Editar una carpeta ajena se avisa antes.

| Carpeta | Dueño | Responsabilidad |
|---|---|---|
| `docs/`, raíz, `docker-compose.yml` | Integrante A | Arquitectura, contrato, decisiones, integración final |
| `backend/` | Integrante B | Módulos, base de datos, migraciones, API |
| `backend/src/modules/programacion/infrastructure/mail/` | Integrante C | Adaptador de correo de la programación semanal |
| `frontend/` | Integrante C | PWA, almacenamiento local, sincronización, vista del supervisor |

El contrato de la API en `docs/contrato-api.md` es lo que permite el trabajo paralelo: B lo implementa, C lo consume con datos simulados hasta que el backend responda. Cambiarlo requiere un PR propio aprobado por A.

## Trabajo con Git

La regla central es que nadie escribe directamente en `main`. Cada tarea vive en su propia rama, se sube a GitHub y se une a `main` mediante un Pull Request que revisa A. Así un error de uno nunca rompe lo de los otros.

Primera vez:

```bash
git clone <url-del-repo>
cd plomada
```

Cada tarea nueva:

```bash
git switch main
git pull                              # trae lo último de los demás
git switch -c feat/backend-programacion   # rama nueva, nombre: tipo/area-tarea

# ...trabajar...

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

Tres reglas para no perder trabajo: hacer `git pull` antes de empezar cada tarea, hacer commits pequeños y frecuentes, y no resolver un conflicto a ciegas. Si Git avisa de un conflicto, se detiene todo y se le pregunta a A. Nunca se sube el archivo `.env`, la carpeta `node_modules` ni fotos de prueba; `.gitignore` ya los excluye.

## Documentación

La fuente de verdad del diseño es `docs/arquitectura.md`. Las decisiones críticas se registran una por archivo en `docs/decisiones/`, con el formato que pide el taller: problema encontrado, opciones evaluadas y opción seleccionada con su razón.
