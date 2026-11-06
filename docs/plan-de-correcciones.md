# Plan de correcciones: Plomada tras la prueba de ejecución

Fecha: 6 de noviembre de 2026. Responsable del plan: Brayan (Rol A). Base: informe de QA de ejecución del 2026-11-06, hecho sobre el merge local de `back-datos` (2ff6883) con `feat/plomada-integral` (ffdaf6d).

Este documento dice qué corrige cada uno, dónde está el problema, qué debe pasar después y cómo se comprueba. Los identificadores D1 a D16 son los del informe de QA. Las líneas citadas son las de ese merge y pueden moverse unas pocas posiciones.

## 1. Estado en una página

La demostración en línea funciona de punta a punta: login, programar, publicar con correo, jornada, fotos idempotentes, revisión y seguimiento. Las 88 pruebas pasan, la autorización por rol responde bien en las 20 rutas protegidas y 18 fotos a 1 Mbps se suben en 94 s (objetivo: menos de 180 s).

El escenario por el que existe el sistema, trabajar sin conexión, falla en los bordes. Una foto se pierde con solo fallos de red, el cliente da por buena una respuesta basura y el estado de una actividad cambia según qué pantalla lo consulte. Además hay un hueco de seguridad (secreto JWT por defecto) y uno de autorización (jornada sobre actividad ajena).

Nada de esto exige rediseñar. Son correcciones acotadas, casi todas con archivo y línea identificados.

## 2. Cómo trabajamos

1. Brayan crea la rama `integracion` desde `origin/back-datos` (2ff6883), le une `feat/plomada-integral` y la sube. El QA comprobó que el merge no tiene conflictos.
2. Desde ese momento no se sube nada más a `back-datos` ni a `feat/plomada-integral`.
3. Cada tarea sale de `integracion` en una rama con prefijo `fix/` (por ejemplo `fix/cola-sincronizacion`) y se abre un PR hacia `integracion`, no hacia `main`.
4. Brayan revisa cada PR contra su criterio de aceptación de este documento. Al final, un solo PR de `integracion` a `main`.
5. No se reescribe historia ni se hace force push. Los commits son pequeños y el título del PR cita el identificador (por ejemplo "D1: cola conserva elementos ante fallos transitorios").
6. Congelamiento: no entra ninguna funcionalidad ni cambio visual nuevo. Solo lo que está en este plan.
7. Cada corrección empieza con una prueba que falla y termina con esa prueba en verde. Sin prueba no hay PR.
8. El contrato no se cambia por cuenta propia. Si una corrección lo necesita, se avisa a Brayan antes: `packages/shared` y `docs/contrato-api.md` los toca el Rol A.
9. Prettier masivo (91 archivos con diferencias) no se ejecuta ahora. Lo hace Brayan al final, en un solo commit, para no generar conflictos.
10. Se puede usar IA para programar, como permite el curso, pero quien abre el PR debe poder explicar cada cambio. La sustentación pregunta por el código, no por la herramienta.

## 3. Plan de Pablo (Rol C: cliente y sincronización)

Todo el trabajo de Pablo vive en `frontend/`. No debe necesitar tocar el backend.

### C-1. Motor de sincronización: no descartar nada por fallos transitorios (D1). Prioridad P0

Dónde: `frontend/src/services/motor-sincronizacion.ts`, alrededor de la línea 181 (`superoIntentos = el.intentos >= 5`) y 183 a 195 (`colaSincronizacion.delete`).

Hoy: tras 6 fallos de cualquier clase, incluido el servidor caído, el elemento se marca `error` y se borra de la cola. La barra pasa a "Al día". La foto queda varada en el celular. Reproducido con solo fallos de red.

Debe pasar:

| Respuesta | Clase | Comportamiento |
|---|---|---|
| Sin red, timeout, corte de conexión | Transitorio | Se conserva, reintento con espera creciente |
| 5xx, 408, 429 | Transitorio | Se conserva, reintento con espera creciente |
| 401 | Sesión | Intenta renovar el token una vez; si no puede, pausa la cola sin descartar |
| 400, 403, 404, 409, 413, 415, 422 y demás 4xx | Definitivo | Se marca `fallido`, se conserva el archivo, deja de reintentarse solo, se avisa al operario |

Reglas:

- Espera creciente: 2 s, 4 s, 8 s y así hasta un tope de 60 s, con algo de variación aleatoria. Sin límite de intentos para los transitorios.
- Nunca se borra un elemento de la cola por haber fallado. Solo se borra cuando el servidor confirmó con una respuesta válida (ver C-4) o cuando el operario lo descarta a propósito (ver C-3).
- El reintento también se dispara con el evento `online`, al enfocar la ventana y al capturar, como hoy.
- Revisar `cliente-api.ts` líneas 68 a 71: una respuesta no válida en `/auth/refresh` borra la sesión local. Un 5xx o una caída de red al renovar no debe cerrar la sesión; solo un 401 o 403 de verdad.

Se comprueba con: la prueba de C-6 con 10 fallos de red seguidos y luego recuperación, que termina con la foto en el servidor; y con el guion manual de la sección 7.

### C-2. Orden de envío: la jornada antes que las fotos (D6). Prioridad P0

Dónde: `motor-sincronizacion.ts` línea 145 (`orderBy("creadoEn")`).

Hoy: el orden de envío observado fue foto, jornada, foto, foto. El contrato exige la jornada primero.

Debe pasar: abrir la sección de sincronización de `docs/contrato-api.md` y cumplir su regla literalmente. En la práctica, los registros de jornada pendientes salen primero, ordenados por hora de captura, y después las evidencias, también por hora de captura. No se mezclan.

Se comprueba con: la prueba de C-6 que captura foto, jornada, foto, foto sin red y verifica que las peticiones llegan en orden jornada, foto, foto, foto.

### C-3. Avisar al operario de lo que falló (D7). Prioridad P0

Dónde: `OperarioDashboard.tsx` líneas 252 a 255 y `BarraSuperior.tsx` líneas 78 a 95.

Hoy: un elemento fallido deja la barra en "Al día", sin aviso ni forma de reenviar. Un registro de jornada con `estadoSincronizacion: "error"` se muestra como "En cola".

Debe pasar:

- La barra distingue pendientes y fallidos: por ejemplo "3 pendientes" y "1 con error". "Al día" solo aparece cuando no hay ninguno de los dos.
- Una lista simple de lo fallido, con el motivo en lenguaje claro y dos acciones: reintentar y descartar. Descartar pide confirmación y es la única forma en que el operario saca algo de la cola.
- El listado de jornada y de evidencias muestra el estado real de cada elemento: en cola, subido, fallido.

Mantener la interfaz mínima. No es un rediseño.

Se comprueba con: provocar un 422 y un 413 en un PUT y ver el aviso, el motivo y el botón de reintento. Tras reintentar con el servidor corregido, el elemento sube.

### C-4. Validar las respuestas con los esquemas del contrato (D8). Prioridad P0

Dónde: `frontend/src/infrastructure/api/cliente-api.ts` líneas 73, 137 y 140 (casts `as SesionRespuesta` y `as T`).

Hoy: una respuesta 200 con `{"basura":true}` o una página HTML de portal cautivo se toma por éxito, la foto se marca sincronizada y se borra de la cola, con el servidor vacío. En una zona de wifi sin internet real, este es el caso más probable de todos.

Debe pasar: toda respuesta se valida con el esquema de `rutas.*.respuesta` de `@plomada/shared`. Una respuesta que no cumple (otro tipo de contenido, JSON fuera de esquema) cuenta como fallo transitorio: el elemento se conserva y se reintenta.

Se comprueba con: la prueba de C-6 que responde 200 con `{}` y con HTML y verifica que el elemento sigue en la cola.

### C-5. Íconos y favicon de la PWA (D9). Prioridad P1

Dónde: no existe `frontend/public/`. `vite.config.ts` líneas 11 y 19 a 28 declaran `pwa-192x192.png`, `pwa-512x512.png` y `favicon.ico`.

Hoy: esas rutas devuelven el HTML de la aplicación con 200 y el favicon 404, por lo que la instalación no es fiable.

Debe pasar: crear `frontend/public/` con los tres archivos reales. Basta un diseño sencillo y sobrio generado desde un SVG. Añadir un ícono `maskable` y un `apple-touch-icon` es opcional.

Se comprueba con: `curl -I` a cada ruta devuelve `image/png` o `image/x-icon`, no HTML; y el panel Application > Manifest de Chrome no muestra errores de íconos.

### C-6. Pruebas automatizadas del motor y C8 (D1, D6, D8). Prioridad P0

Hoy el frontend tiene 3 pruebas que solo verifican constantes y `crypto.randomUUID()`. No hay ninguna del motor, la cola ni la compresión. Con eso, el criterio C8 del plan de trabajo no se cumple.

Debe pasar: pruebas con Vitest sobre IndexedDB simulado (por ejemplo `fake-indexeddb`) y una API simulada. Si se añade esa dependencia, se menciona en el PR. Mínimo estos casos:

1. Tres fotos sin conexión, se vuelve la red y llegan exactamente 3 al servidor (C8).
2. Diez fallos de red seguidos y luego recuperación: la foto llega, nunca se descartó.
3. 503, 408 y 429 se reintentan y se conservan.
4. 422 y 413 se marcan fallidos de inmediato, se conserva el archivo y no se reintentan solos.
5. Orden de envío: jornada antes que fotos.
6. Respuesta 200 fuera de esquema y respuesta HTML: el elemento sigue en la cola.
7. Respuesta perdida tras llegar al servidor: el reintento usa el mismo UUID y no duplica.
8. Cerrar y reabrir con la cola llena: nada se pierde.

Se comprueba con: `pnpm --filter @plomada/frontend test` en verde y con esos 8 casos presentes.

### C-7. Prueba en un celular real. Prioridad P1

El QA no tuvo dispositivos, así que esto sigue sin demostrarse (C1 y EC-10). Con el celular de gama baja que haya a mano, sobre el build de producción servido por HTTPS o `localhost`:

- Instalar la PWA desde el navegador.
- Abrirla en modo avión después de la primera carga.
- Registrar entrada, tomar 3 fotos sin red, registrar fin.
- Volver la red y comprobar que todo llega.

Dejar el resultado (modelo del celular, navegador, qué funcionó, qué no) en un párrafo del PR o en `docs/pruebas-celular.md`. Con eso Brayan puede citarlo en el documento.

### Si falta tiempo en el lado de Pablo

El orden de corte es C-1, C-4, C-2, C-3, C-6, C-5, C-7. Si hay que dejar algo fuera, se deja C-7 primero y se anota como pendiente conocido.

## 4. Plan de Juan Camilo (Rol B: backend y datos)

Todo el trabajo de Juan vive en `backend/` y en la CI. Como el backend es suyo por rol, tocar `composition-root.ts` y los casos de uso es lo esperado.

### B-1. Secreto JWT por defecto (D2). Prioridad P0

Dónde: `backend/src/composition-root.ts` línea 85, `process.env.JWT_ACCESS_SECRET ?? "secreto-desarrollo-plomada-2026-min-32-chars"`.

Hoy: con `NODE_ENV=production` y sin la variable, el servidor arranca. Con ese secreto, que está en el repositorio, el QA forjó un token de administrador y listó los 9 usuarios.

Debe pasar:

- Sin valor por defecto en el código. Si `JWT_ACCESS_SECRET` falta o tiene menos de 32 caracteres fuera de `test`, el proceso termina con código distinto de cero y un mensaje claro.
- El valor de ejemplo vive solo en `.env.example`, para desarrollo.
- `seed.ts` se niega a ejecutarse con `NODE_ENV=production`, porque hace `TRUNCATE ... CASCADE` de todas las tablas (línea 54) y usa claves fijas.

Se comprueba con: arrancar con `NODE_ENV=production` sin secreto y verificar que sale con error; una prueba que lo automatice.

### B-2. La jornada valida a quién pertenece la actividad (D3 y D5). Prioridad P0

Dónde: `modules/jornada/application/registrar-jornada.use-case.ts` líneas 17 a 48 e `infrastructure/http/jornada.router.ts`.

Hoy: el operario 2 registró una jornada sobre la actividad del operario 1 y quedó guardada, alterando además el estado de esa actividad. Con una actividad o un centro inexistentes, la violación de clave foránea sale como 500 y el cliente lo reintenta sin fin.

Debe pasar:

- Antes de guardar, el caso de uso verifica que la actividad exista y esté asignada al operario autenticado, y que el centro de trabajo exista. Actividad o centro inexistente: 404 `no_encontrado`. Actividad ajena: 403 `sin_permiso`.
- La verificación se hace por un puerto que exponga `programacion` en su `index.ts`, no con SQL a tablas de otro módulo. Misma regla que ya aplica `evidencias`.
- La idempotencia se conserva: el mismo id con el mismo contenido devuelve 200; con otro contenido, 409.

Se comprueba con: pruebas de contrato HTTP para op2 sobre actividad de op1 (403 y ninguna fila nueva), actividad inexistente (404), centro inexistente (404) y reintento idéntico (200).

### B-3. Un solo cálculo del estado de la actividad (D4 y D13). Prioridad P0

Dónde: `evidencias/application/listar-actividades.use-case.ts` líneas 45 a 48 y `obtener-actividad-detalle.use-case.ts` líneas 24 a 27 (pasan solo evidencias y revisión, sin hechos de jornada); `composition-root.ts` líneas 173, 209 y 288 (SQL que cruza tablas de varios módulos); y el import de `../../programacion/domain/estado-actividad` en la línea 2 de los dos casos de uso.

Hoy: con solo `inicio_actividad`, `mi-programacion` y `seguimiento` dicen `en_curso`, y `/actividades` y `/actividades/:id` dicen `pendiente`. Con solo `fin_actividad`, `pendiente` contra `finalizada`. Es la contradicción con EC-02 y con la regla de que el estado se deriva siempre de los mismos hechos.

Debe pasar:

- Todo cálculo de estado pasa por el puerto `HechosDeActividad` y la función pura `derivarEstado`. Los cuatro puntos de consulta (`mi-programacion`, `seguimiento`, `/actividades`, `/actividades/:id`) usan el mismo camino y reciben los hechos de jornada, evidencias y revisión.
- Las consultas SQL que hoy están en `composition-root.ts` se mueven a la infraestructura del módulo dueño de cada tabla. La raíz de composición solo cablea: conecta puertos con adaptadores, sin SQL.
- Los módulos se hablan solo por su `index.ts`. El import de archivo interno de `programacion` desde `evidencias` pasa a ir por `../../programacion`.
- La nota 010 es la guía de diseño. Si Juan necesita una forma distinta a la que describe, lo habla con Brayan antes, y se ajusta la nota.

Se comprueba con:

- Pruebas que registran solo inicio, solo fin y cualquier orden de llegada, y verifican que los cuatro puntos de consulta devuelven el mismo estado.
- `grep -nE "JOIN|FROM " backend/src/composition-root.ts` no devuelve consultas SQL.
- Opcional y recomendado: una prueba de arquitectura de unas treinta líneas que recorra los imports de `modules/*` y falle si un módulo importa un archivo interno de otro. Protege la regla que más se va a preguntar en la sustentación.

### B-4. Errores siempre con la misma forma (D10). Prioridad P1

Dónde: `composition-root.ts` línea 348 (no hay manejador global de errores).

Hoy: JSON roto, cuerpo de más de 5 MB y ruta inexistente devuelven una página HTML de Express, y sin `NODE_ENV` definido se expone el mensaje de la excepción. El contrato dice que todo error tiene la forma `{codigo, mensaje}`.

Debe pasar: un manejador final de errores y un manejador de ruta no encontrada. JSON malformado, cuerpo excesivo, ruta desconocida y error no previsto devuelven JSON con un código del catálogo del contrato (`validacion`, `no_encontrado`, `error_interno` y los demás que ya existen). En producción no se filtra el mensaje de la excepción. De paso, `app.disable("x-powered-by")`.

Se comprueba con: pruebas de contrato HTTP para cada uno de los cuatro casos.

### B-5. Puerto de pruebas y CI (D12). Prioridad P0

Dónde: `adaptadores-pg.test.ts` línea 14, `contrato-http.test.ts` línea 29, `integration.test.ts` línea 12 y `.github/workflows/ci.yml`.

Hoy: las tres suites usan el 5433 por defecto y el compose y `.env.example` usan el 5432. Sin variables, 30 pruebas fallan con `ECONNREFUSED`. La CI no levanta PostgreSQL, así que fallaría igual.

Debe pasar:

- Las pruebas leen `DATABASE_URL_TEST` y, si no está, usan `postgres://plomada:plomada@localhost:5432/plomada_test`. Quien tenga el 5432 ocupado exporta la variable o usa `POSTGRES_PORT` en el compose.
- La CI declara un servicio PostgreSQL (misma versión que el compose, 17), crea `plomada_test`, corre `migrate:test` y ejecuta `typecheck` y las pruebas de todos los paquetes.
- Una sección corta en el README, "Entorno sin Docker", con los pasos que el QA tuvo que armar a mano: PostgreSQL nativo con rol y bases `plomada` y `plomada_test`, y Mailpit como ejecutable. Brayan no usa Docker y esa es su ruta.

Se comprueba con: CI en verde en el PR y `pnpm --filter @plomada/backend test` en una máquina limpia sin variables exportadas.

### B-6. Pruebas que faltaban (cierra B7). Prioridad P0

Las 26 pruebas nuevas cubren el contrato de evidencias e identidad, pero el QA lista como sin prueba: la propiedad del recurso en jornada, la coherencia del estado entre consultas y los errores que no son JSON. Las pruebas de B-1 a B-4 las cubren. Sumar una de `GET /seguimiento/dia`, que no aparece en ninguna prueba del backend.

### B-7. Si sobra tiempo. Prioridad P2

- D11: comprobar los primeros bytes del archivo (`FF D8 FF` para JPEG) y responder 415 `archivo_invalido` si no coincide.
- D14: volver atómico el "buscar y luego guardar" de la subida de evidencias, con `INSERT ... ON CONFLICT DO NOTHING`, para que bajo concurrencia solo haya un 201. Hoy los datos quedan íntegros; es cosmético.

### Si falta tiempo en el lado de Juan

El orden de corte es B-1, B-3, B-2, B-5, B-6, B-4, B-7. B-1 y B-2 son seguridad y no se negocian.

## 5. Plan de Brayan (Rol A: integración, documento y demostración)

Antes de que los demás avancen:

- Crear y subir `integracion` (sección 2). Es lo único que bloquea a Pablo y a Juan.

En paralelo mientras ellos corrigen (archivos de documentación, no chocan con el código):

- Llevar a `docs/contrato-api.md` los cambios hechos en `packages/shared`, y correr la prueba que verifica que el registro de rutas aparece completo en el documento.
- Corregir la nota 008, que amplió el alcance a favor de quien implementaba. Escribir una nota nueva que apruebe el panel de administración que ya existe y registre por qué se conserva.
- Escribir una nota que registre la autorización por rol en el router (hallazgo H-06 de la auditoría) como desvío aceptado, con su razón y la deuda que deja.
- Actualizar `docs/decisiones/README.md`: Dexie como elección del cliente (nota 011), Workbox solo por `vite-plugin-pwa` para el precaché y `navigator.storage.persist()` al iniciar. Quitar cualquier rastro de `idb` como valor por defecto.
- Ajustar `dependencias-modulos.d2`: declara 6 aristas entre módulos y el código tiene una. El diagrama debe decir solo lo que existe.
- Preparar el guion de la demostración (A11) y planear el ensayo (I4).

Después de que se integren las correcciones:

- Revisar los ítems 6, 7 y 8 del documento contra el código final. El ítem 7 debe dejar de afirmar que no hay consultas entre módulos solo cuando B-3 esté cerrado; hasta entonces lleva un TODO.
- Añadir la tabla que lleva cada principio SOLID y de Clean Code del ítem 5 a un archivo y una línea reales del repositorio, verificando cada uno abriendo el archivo.
- Añadir una sección de verificación con las cifras medidas por el QA (93,75 s para 18 fotos a 1 Mbps, p95 de 10 ms en fotos bajo carga, 146 kB de carga inicial) y con sus limitaciones declaradas (20 s de carga y no 30 min, localhost, base casi vacía). Documentar también los defectos conocidos que no se corrigieron.
- Regenerar los SVG desde sus `.d2`, revisar que ninguna figura quede ilegible y generar el PDF. Cambiar el estado de "Borrador" a final.
- Correr Prettier sobre todo el repositorio en un solo commit, al final.
- Abrir el PR único de `integracion` a `main` con la CI en verde.

## 6. Orden, dependencias y tiempos

Los tiempos son estimaciones para quien conoce el código; si alguien ve que se le va el doble, que lo diga.

| Tarea | Quién | Prioridad | Estimado | Depende de |
|---|---|---|---|---|
| Rama `integracion` | Brayan | P0 | 15 min | nada |
| C-1 motor: no descartar | Pablo | P0 | 3 h | integracion |
| C-2 orden jornada | Pablo | P0 | 30 min | C-1 |
| C-4 validar con zod | Pablo | P0 | 1 h | integracion |
| C-3 aviso al operario | Pablo | P0 | 2 h | C-1 |
| C-6 pruebas del motor | Pablo | P0 | 3 h | C-1, C-2, C-4 |
| C-5 íconos | Pablo | P1 | 30 min | integracion |
| C-7 celular real | Pablo | P1 | 1 h | C-1 a C-5 |
| B-1 secreto JWT | Juan | P0 | 30 min | integracion |
| B-5 puerto y CI | Juan | P0 | 1,5 h | integracion |
| B-2 jornada y propiedad | Juan | P0 | 1,5 h | integracion |
| B-3 estado único y SQL | Juan | P0 | 4 h | B-2 |
| B-4 errores JSON | Juan | P1 | 1 h | integracion |
| B-6 pruebas faltantes | Juan | P0 | incluido | B-1 a B-4 |
| Documentos, contrato, notas | Brayan | P0 | en paralelo | integracion |
| Ítems 6, 7 y 8, PDF final | Brayan | P0 | 3 h | B-3, C-1 a C-4 |

El trabajo de Pablo y el de Juan es independiente: ninguno toca los archivos del otro, salvo `cliente-api.ts` (solo Pablo) y los casos de uso de `programacion` y `evidencias` (solo Juan). Si algún PR necesita archivos del otro, se avisa antes.

## 7. Cuándo está terminado

Cada PR cumple esto antes de pedir revisión:

- La prueba que falla antes de la corrección y pasa después está incluida.
- `pnpm -r typecheck` y las pruebas del paquete tocado pasan.
- La descripción nombra el identificador (D1, B-3, etc.), qué se cambió y cómo se comprobó.
- No se cambió el contrato ni se añadió funcionalidad fuera del plan.

El conjunto está terminado cuando se cumple el guion de aceptación final, que ejecutan los tres juntos sobre `integracion`:

1. Con el backend, PostgreSQL y Mailpit arriba, el administrador crea y publica una programación y llegan los correos.
2. Un operario, en modo avión, registra entrada, toma tres fotos y registra fin.
3. Se corta la red de otra forma (servidor detenido durante varios minutos) y se verifica que nada se pierde al volver.
4. Vuelve la conexión: llegan exactamente 3 fotos y las jornadas, en ese orden, sin duplicados.
5. El supervisor ve la actividad con el mismo estado que el operario y la revisa.
6. Las pruebas de ambos paquetes y la CI están en verde.

## 8. Fuera de alcance, a propósito

Estas cosas se dejan fuera y se documentan como límites conocidos en lugar de ocultarse:

- ESLint y Prettier masivo (Prettier lo hace Brayan al final).
- Compresión adaptativa de fotos (D16): hoy produce 631 kB en el peor caso sintético, dentro del límite de 1,5 MB.
- Edición de una programación publicada: el contrato no tiene esa ruta.
- Autorización por rol dentro de los casos de uso en lugar de en el router (H-06): queda como desvío aceptado y registrado.
- TLS, carga sostenida de 30 minutos y disponibilidad del 99,5 %: no se pueden medir en local.

## 9. Comunicación

- Si algo se atasca más de una hora, se avisa en el chat con el síntoma y lo que ya se probó.
- Si una corrección parece exigir cambiar el contrato o una decisión registrada, se para y se consulta a Brayan.
- Al abrir un PR, avisar en el chat con el enlace y el identificador.
