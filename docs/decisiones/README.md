# Decisiones

Cada decisión crítica del proyecto vive en una nota numerada de este directorio, con las tres partes que pide el taller: problema encontrado, opciones evaluadas y opción seleccionada con su porqué. Estas notas son la materia prima del ítem 11 del documento de arquitectura, por eso se escriben cuando se decide y no al final.

Para crear una nota, copia la estructura de cualquiera de las existentes, usa el siguiente número libre y ponla en el mismo PR que introduce la decisión.

## Decisiones tomadas

| Nota                                         | Decisión                                                                             | Responsable |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | ----------- |
| [001](001-estilo-arquitectonico.md)          | Monolito modular con arquitectura hexagonal                                          | A           |
| [002](002-cliente-sin-conexion.md)           | PWA que funciona primero sin conexión                                                | A           |
| [003](003-stack-y-workspace.md)              | PERN con TypeScript, workspace de pnpm y paquete `shared`                            | A           |
| [004](004-contrato-como-codigo.md)           | Contrato REST expresado como esquemas zod compartidos                                | A           |
| [005](005-sincronizacion-y-tiempo.md)        | Escrituras idempotentes con UUID del cliente, dos horas por evento y estado derivado | A           |
| [006](006-autenticacion.md)                  | Token de acceso corto y refresh rotativo                                             | A           |
| [007](007-fotos.md)                          | Subida multipart, disco local detrás de un puerto y compresión en el cliente         | A           |
| [008](008-alcance-v1.md)                     | Alcance mínimo vertical y prioridades P0 a P2                                        | A           |
| [009](009-seguimiento-polling.md)            | Seguimiento por polling                                                              | A           |
| [010](010-dependencias-entre-modulos.md)     | Grafo de dependencias entre módulos sin ciclos                                       | A           |
| [011](011-almacenamiento-local-dexie.md)     | Almacenamiento local en el cliente PWA con Dexie.js                                  | C           |
| [012](012-migraciones-sql-propias.md)        | Migraciones SQL numeradas con un ejecutor propio                                     | B           |
| [013](013-panel-administracion.md)           | Panel web de administración como excepción al alcance v1                             | A           |
| [014](014-autorizacion-por-rol-en-router.md) | Autorización por rol en el router, desvío de AGENTS.md                               | A           |
| [015](015-dominio-de-correo-de-operarios.md) | El contrato no fija el dominio del correo de los operarios                           | A           |

## Decisiones abiertas, con valor por defecto

Lo que sigue lo deciden B y C dentro de su carpeta. Cada fila trae un valor por defecto para que nadie espere una respuesta de A: si no se decide otra cosa antes de empezar la tarea correspondiente, rige el valor por defecto. Cualquier desvío se registra en una nota nueva, en el mismo PR que lo introduce. Ninguna de estas decisiones altera el contrato ni la estructura de módulos; si una lo hiciera, es un cambio de contrato y pasa por A.

### Backend (B)

| Tema                   | Valor por defecto                                                                                                       | Nota                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Servidor HTTP          | Express 5                                                                                                               | Es la E de PERN                                               |
| Acceso a datos         | `pg` con SQL directo dentro de los repositorios                                                                         | Un ORM requiere nota previa                                   |
| Migraciones            | Ejecutor propio sobre `pg` con archivos SQL planos en `backend/db/migrations/`                                          | Desvío del valor original, nota 012                           |
| Hash de contraseñas    | argon2id con `@node-rs/argon2`                                                                                          | Trae binarios precompilados y no obliga a compilar en Windows |
| Tokens                 | `jose`                                                                                                                  |                                                               |
| Multipart              | `multer`                                                                                                                |                                                               |
| Registro de eventos    | `pino`                                                                                                                  |                                                               |
| Pruebas de adaptadores | Base `plomada_test` del compose, variable `DATABASE_URL_TEST`                                                           |                                                               |
| Datos del demo         | Script `pnpm --filter backend seed` con un administrador, un supervisor, tres operarios, dos centros y una programación | Ver nota 008                                                  |

### Cliente (C)

| Tema                            | Valor por defecto                                                         | Nota                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Rutas                           | `react-router`                                                            |                                                                                       |
| Estado                          | Estado local de React y hooks propios, sin librería de estado global      |                                                                                       |
| Almacenamiento local            | Dexie.js sobre IndexedDB                                                  | Desvío del valor original, nota 011                                                   |
| Persistencia del almacenamiento | Llamar a `navigator.storage.persist()` al iniciar la app                  | Evita que el navegador desaloje la cola y las fotos pendientes cuando falta espacio   |
| Service worker                  | `vite-plugin-pwa`, que usa Workbox solo para el precaché de la aplicación | La cola de sincronización es código propio sobre Dexie, no Workbox ni Background Sync |
| Captura de foto                 | `<input type="file" accept="image/*" capture="environment">`              | Funciona en cualquier gama sin pedir permisos de cámara                               |
| Compresión                      | Canvas nativo, sin dependencia, hacia `LIMITES_EVIDENCIA`                 |                                                                                       |
| Datos simulados                 | `msw` con respuestas que cumplen los esquemas de `shared`                 |                                                                                       |
| Estilos                         | CSS plano o CSS Modules                                                   | Sin librerías de interfaz pesadas por los teléfonos de gama baja                      |
| Disparadores de sincronización  | Al abrir la app, evento `online` y botón manual                           | No depender de Background Sync, que iOS no soporta                                    |
| Prueba en celular real          | Certificado de desarrollo local o túnel HTTPS                             | Ver nota 002                                                                          |
