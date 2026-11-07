# Contrato de la API v1

Este documento explica la semántica del contrato entre backend y frontend. Su forma ejecutable vive en `shared/`: los esquemas zod describen cada cuerpo y `shared/src/contrato.ts` registra cada ruta con su método, acceso, prioridad y esquemas. Una prueba de `shared` falla si una ruta del código no aparece aquí, así que los dos cambian siempre juntos.

Un cambio al contrato es un PR propio que toca este archivo y `shared/` a la vez, lo aprueba A y se une antes del código que lo usa. Quien necesite un cambio lo propone con el motivo concreto; el contrato se congela tras la fase 0 precisamente para que nadie descubra tarde que el otro lado asumía otra cosa.

## Convenciones

La API vive bajo `/api/v1`. En desarrollo el cliente llama siempre a esa ruta en su propio origen y Vite la reenvía al backend, de modo que no hay CORS que configurar. Todo cuerpo es JSON en UTF-8, salvo la subida de fotos, que es `multipart/form-data`. Los nombres de campo están en español y en camelCase; las únicas excepciones son `accessToken` y `refreshToken`, que son términos estándar.

La autenticación va en la cabecera `Authorization: Bearer <accessToken>`. Los identificadores son UUID v4. Los crea el servidor, salvo en lo que el cliente genera sin conexión (evidencias y registros de jornada), donde el UUID nace en el celular y viaja en la URL. Los instantes son ISO 8601 en UTC con sufijo `Z`, y las fechas de calendario son `AAAA-MM-DD`. «Hoy», la semana en curso y el día al que pertenece un instante se cuentan en hora de Bogotá (UTC-5), no en UTC; ver la nota 016. No hay paginación en v1: con unos 150 operarios y un día de trabajo las listas son pequeñas y se acotan con filtros.

Todo error tiene la misma forma, `{ codigo, mensaje, campos? }`, con un código de la lista fija de `CODIGOS_ERROR`.

| Código             | HTTP      | Cuándo                                                                      |
| ------------------ | --------- | --------------------------------------------------------------------------- |
| `no_autenticado`   | 401       | Falta el token, venció o es inválido                                        |
| `sin_permiso`      | 403       | El rol, o el operario, no puede hacer esto                                  |
| `no_encontrado`    | 404       | El recurso no existe                                                        |
| `conflicto`        | 409       | El id ya existe con contenido distinto, o el estado no permite la operación |
| `archivo_invalido` | 413 o 415 | Foto fuera del tamaño o del tipo permitido                                  |
| `validacion`       | 422       | El cuerpo o los parámetros no cumplen el esquema; `campos` indica cuáles    |
| `error_interno`    | 500       | Error no previsto                                                           |

## Prioridades

P0 es lo necesario para la demostración del taller. P1 completa el flujo del operario y del administrador. P2 queda diseñado y se implementa solo si sobra tiempo; nadie debe depender de un P2. B implementa en el orden P0, P1, P2, y C construye primero las pantallas que consumen P0.

## Endpoints

La columna de acceso usa los cuatro roles del sistema. "Autenticado" significa cualquier rol, y "público" que no lleva token.

### Estado y sesión

| Ruta                 | Acceso      | Prioridad | Solicitud           | Respuesta         |
| -------------------- | ----------- | --------- | ------------------- | ----------------- |
| `GET /salud`         | público     | P0        |                     | `Salud`           |
| `POST /auth/login`   | público     | P0        | `LoginSolicitud`    | `SesionRespuesta` |
| `POST /auth/refresh` | público     | P0        | `RefrescoSolicitud` | `SesionRespuesta` |
| `GET /auth/me`       | autenticado | P0        |                     | `Usuario`         |

El login entrega un token de acceso de 15 minutos y un refresh token de 7 días. El refresh token rota en cada uso: la respuesta de `POST /auth/refresh` trae uno nuevo y el anterior deja de servir. La cola de sincronización puede drenarse horas después de haber tomado las fotos, con el token de acceso ya vencido, y por eso el cliente renueva la sesión antes de subir. Un 401 en el refresh significa que la sesión caducó del todo: el operario inicia sesión de nuevo y la cola no se borra. `SesionRespuesta` trae además `accessExpiraEn`, el instante en que vence el token de acceso, para que el cliente decida si renovar antes de subir, y el `Usuario` autenticado.

### Usuarios y centros de trabajo

| Ruta                    | Acceso                                    | Prioridad | Solicitud                   | Respuesta         |
| ----------------------- | ----------------------------------------- | --------- | --------------------------- | ----------------- |
| `GET /usuarios`         | supervisor, administrativo, administrador | P1        | `UsuariosFiltro` (consulta) | `Usuario[]`       |
| `POST /usuarios`        | administrador                             | P1        | `UsuarioCrear`              | `Usuario`         |
| `GET /centros-trabajo`  | autenticado                               | P1        |                             | `CentroTrabajo[]` |
| `POST /centros-trabajo` | administrativo, administrador             | P1        | `CentroTrabajoCrear`        | `CentroTrabajo`   |

`UsuariosFiltro` acepta un `rol` opcional. `UsuarioCrear` pide `nombre` de al menos 3 caracteres, `correo` válido, `rol` y `contrasenaInicial` de al menos 8 caracteres que no sean solo espacios. El contrato solo exige que el correo esté bien formado, sin importar el rol: el enunciado pide que cada operario tenga correo institucional y que la programación le llegue por correo, y el dominio real de la empresa no lo conoce el contrato. Si un despliegue quiere restringir el dominio de los operarios, esa política es configuración del servidor y no parte del esquema (nota 015).

Los usuarios y centros del demo nacen de un script de semilla del backend, y las rutas de esta sección permiten crear más desde el panel de administración (nota 013).

### Programación semanal

| Ruta                                | Acceso                        | Prioridad | Solicitud                         | Respuesta               |
| ----------------------------------- | ----------------------------- | --------- | --------------------------------- | ----------------------- |
| `POST /programaciones`              | administrativo, administrador | P0        | `ProgramacionCrear`               | `ProgramacionSemanal`   |
| `GET /programaciones`               | administrativo, administrador | P1        | `ProgramacionesFiltro` (consulta) | `ProgramacionSemanal[]` |
| `GET /programaciones/:id`           | administrativo, administrador | P1        |                                   | `ProgramacionSemanal`   |
| `POST /programaciones/:id/publicar` | administrativo, administrador | P0        |                                   | `ProgramacionSemanal`   |
| `GET /mi-programacion`              | operario                      | P0        | `MiProgramacionFiltro` (consulta) | `MiProgramacion`        |

Hay una sola programación por semana: crear una segunda para el mismo lunes devuelve `conflicto`. Nace en estado `borrador`, solo admite asignaciones de lunes a viernes y no se edita una vez publicada; corregirla queda fuera de v1.

`POST /programaciones/:id/publicar` la pasa a `publicada` y dispara el correo a cada operario con asignaciones, con su semana completa: día, centro de trabajo y actividades. El envío es un efecto secundario que no bloquea la respuesta ni la hace fallar; un correo caído se registra en el log y no se reintenta en v1. Publicar una programación ya publicada devuelve 200 con la misma programación y no reenvía correos.

`GET /mi-programacion` devuelve solo programaciones publicadas y solo las asignaciones del operario autenticado, con el centro de trabajo embebido, para que el cliente guarde la semana entera con una sola llamada y trabaje sin conexión. Sin `semanaInicio` entrega la semana en curso. Si el operario no tiene programación publicada en esa semana, entrega la publicada más reciente que sí tenga (la de `semanaInicio` más alta), para que el celular no quede en blanco; solo si no tiene ninguna devuelve `asignaciones` vacío. Por eso el cliente debe leer `semanaInicio` de la respuesta y no suponer que es la semana actual.

### Jornada

| Ruta                         | Acceso                                    | Prioridad | Solicitud                           | Respuesta           |
| ---------------------------- | ----------------------------------------- | --------- | ----------------------------------- | ------------------- |
| `PUT /registros-jornada/:id` | operario                                  | P1        | `RegistroJornadaSolicitud`          | `RegistroJornada`   |
| `GET /registros-jornada`     | supervisor, administrativo, administrador | P1        | `RegistrosJornadaFiltro` (consulta) | `RegistroJornada[]` |

`RegistrosJornadaFiltro` exige `fecha` y acepta `operarioId` opcional. Un registro es una de cuatro cosas: `entrada_centro` y `salida_centro`, que llevan `centroTrabajoId`, o `inicio_actividad` y `fin_actividad`, que llevan `actividadId`. `capturadoEn` es la hora real del evento según el celular y `recibidoEn` la del servidor; ambas se guardan y se muestran, y ninguna se corrige. Un celular con el reloj desajustado produce un `capturadoEn` dudoso, y lo que se hace es dejar las dos horas a la vista del supervisor en lugar de adivinar cuál es la buena.

### Evidencias y revisión

| Ruta                            | Acceso                                              | Prioridad | Solicitud                      | Respuesta            |
| ------------------------------- | --------------------------------------------------- | --------- | ------------------------------ | -------------------- |
| `PUT /evidencias/:id`           | operario                                            | P0        | `EvidenciaCampos` (+ archivo)  | `Evidencia`          |
| `GET /evidencias/:id/foto`      | operario, supervisor, administrativo, administrador | P0        |                                | imagen binaria       |
| `GET /actividades`              | supervisor, administrativo, administrador           | P0        | `ActividadesFiltro` (consulta) | `ActividadResumen[]` |
| `GET /actividades/:id`          | supervisor, administrativo, administrador           | P0        |                                | `ActividadDetalle`   |
| `PUT /actividades/:id/revision` | supervisor                                          | P0        | `RevisionSolicitud`            | `Revision`           |

`PUT /evidencias/:id` es un `multipart/form-data` con los campos de texto de `EvidenciaCampos` (`actividadId`, `tipo`, `capturadaEn`) y el archivo en el campo `foto`. El tipo de archivo permitido es `image/jpeg` o `image/webp`, con un máximo de 1.5 MB; el cliente comprime a unos 400 KB y a un lado mayor de 1600 px antes de encolar, y los números exactos están en `LIMITES_EVIDENCIA`. El operario sale del token, no del cuerpo, y debe ser el asignado a la actividad; si no, `sin_permiso`. Se admite más de una evidencia por tipo, porque repetir una foto borrosa es normal. Una foto ya recibida nunca se reemplaza. `GET /evidencias/:id/foto` responde con el `Content-Type` real y `Cache-Control: private, max-age=31536000, immutable`, porque una foto con un id dado nunca cambia.

`ActividadesFiltro` acepta `revision` (`pendiente` o `revisada`), `fecha` y `centroTrabajoId`, todos opcionales. `GET /actividades` con `revision=pendiente` es la cola de trabajo del supervisor: las actividades con al menos una evidencia y sin revisión. `ActividadDetalle` agrega a `ActividadResumen` la lista de evidencias y la revisión, si existe. `Revision.observacion` admite hasta 500 caracteres. `PUT /actividades/:id/revision` registra la decisión del supervisor y solo procede si la actividad ya tiene al menos una evidencia; si no, `conflicto`. Un rechazo exige observación. Un nuevo `PUT` sobre la misma actividad reemplaza la revisión anterior, porque en v1 no hay historial de decisiones.

### Personal y seguimiento (P2)

| Ruta                              | Acceso                                    | Prioridad | Solicitud                      | Respuesta        |
| --------------------------------- | ----------------------------------------- | --------- | ------------------------------ | ---------------- |
| `GET /operarios/:id/hoja-de-vida` | supervisor, administrativo, administrador | P2        |                                | `HojaDeVida`     |
| `PUT /operarios/:id/hoja-de-vida` | administrativo, administrador             | P2        | `HojaDeVidaGuardar`            | `HojaDeVida`     |
| `GET /seguimiento/dia`            | supervisor, administrativo, administrador | P2        | `SeguimientoFiltro` (consulta) | `SeguimientoDia` |

Los tres endpoints están implementados y los consume el panel web, aunque su prioridad sigue siendo P2: ninguna parte de la demostración mínima depende de ellos. Si el operario no tiene hoja de vida, el `GET` responde `no_encontrado`. El `PUT` guarda la hoja completa del operario del que habla la URL, la crea o la reemplaza, y devuelve 200 en ambos casos. Además de los datos personales y laborales, la hoja lleva `cursoAlturas` y `vencimientoAlturas`, ambos opcionales, que registran la certificación de trabajo en alturas y su vencimiento.

`GET /seguimiento/dia` sin `fecha` entrega el día de hoy en Bogotá. Por cada operario devuelve su centro de trabajo (`null` si ese día no tiene asignaciones), `entradaEn` y `salidaEn` (el `capturadoEn` de la primera entrada y de la última salida registradas ese día, o `null`), y sus actividades con el estado derivado y el número de evidencias recibidas. Lo consulta el cliente por polling cada 10 a 15 segundos; ver la nota de decisión 009.

## Sincronización sin conexión

Estas reglas son el acuerdo entre el cliente y el servidor para el escenario más importante del sistema.

Toda escritura que nace en el celular es un `PUT` idempotente sobre un UUID que el cliente generó al capturar. La primera vez devuelve 201. Repetirla con el mismo contenido devuelve 200 con el recurso ya guardado, y así reintentar tras un corte nunca duplica nada. Repetirla con contenido distinto devuelve `conflicto`. Para las evidencias, "mismo contenido" se compara por los campos de texto, y el archivo de un id ya recibido no se reemplaza.

El cliente drena la cola de a un elemento por vez, primero los registros de jornada, que pesan poco, y luego las fotos, ambos en orden de captura. Va de uno en uno para no saturar un enlace malo. Un fallo de red, un 408, un 429 o un 5xx se reintenta con espera creciente. Un 401 dispara la renovación de sesión y se reintenta. Cualquier otro 4xx no se reintenta: se marca el elemento como fallido, se conserva y se le avisa al operario, porque insistir no lo va a arreglar. Un caso típico es un 404 porque la actividad desapareció de la programación.

`capturadoEn` y `capturadaEn` se toman en el instante del evento con `new Date().toISOString()`, nunca al encolar ni al enviar. Un UUID se genera con `crypto.randomUUID()`, que solo existe en contexto seguro; en un navegador eso significa HTTPS o `localhost`.

## Estado de una actividad

El estado no lo guarda nadie ni lo envía el cliente: el servidor lo deriva de los hechos registrados, aplicando estas reglas en orden hasta que una se cumpla.

| Estado       | Condición                                                   |
| ------------ | ----------------------------------------------------------- |
| `aprobada`   | Existe una revisión con resultado `aprobada`                |
| `rechazada`  | Existe una revisión con resultado `rechazada`               |
| `finalizada` | Existe un `fin_actividad` o una evidencia de tipo `despues` |
| `en_curso`   | Existe un `inicio_actividad` o cualquier evidencia          |
| `pendiente`  | Ninguna de las anteriores                                   |

Derivar el estado en vez de almacenarlo hace que el orden de llegada no importe: una foto `despues` que llega antes que la `antes` produce el mismo resultado final. También significa que el demo funciona aunque el módulo de jornada no esté implementado, porque las evidencias solas ya mueven la actividad de estado.

## Historial

| Versión     | Fecha      | Cambio                                                                                                                                                                                                                           |
| ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1 borrador | 2026-11-04 | Primera versión, escrita por A para revisión con B y C en la fase 0                                                                                                                                                              |
| v1          | 2026-11-06 | Alineada con el código integrado: campos de `UsuarioCrear`, `accessExpiraEn`, filtros de consulta, hoja de vida con alturas y seguimiento implementados. `UsuarioCrear` ya no fija el dominio del correo del operario (nota 015) |
