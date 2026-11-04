# Plan de trabajo

Este documento reparte el taller entre los tres integrantes, define cómo se toma y se integra cada tarea y fija los puntos en los que el trabajo de todos se junta. Va en `docs/plan-de-trabajo.md`. Las fechas se completan cuando el grupo confirme la fecha de entrega; hasta entonces el plan se ordena por fases y puntos de integración, no por días.

## Qué se entrega

El taller pide un documento de arquitectura de once ítems y al menos dos módulos del sistema funcionando en local, con la demostración de que el diseño aplica los principios vistos en clase. Se permite usar IA si cada decisión se sustenta con esos principios. Plomada entrega el documento completo y tres módulos corriendo: `identidad` (mínimo), `programacion` y `evidencias`. La parte difícil, y la que más conviene mostrar, es que un operario sin conexión tome tres fotos, las encole en su celular y las sincronice después sin duplicados.

## Cómo se trabaja

Contrato primero. Nadie espera el código de otro: B y C trabajan contra el contrato de la API (`docs/contrato-api.md` más los esquemas de `shared/`), y mientras el backend no responda, C usa datos simulados que cumplen esos mismos esquemas. Cada tarea es una rama, una rama es un PR pequeño y A lo revisa el mismo día. Nadie tiene más de dos PR abiertos a la vez, para que `main` siempre refleje lo que de verdad funciona. Una tarea está terminada cuando `pnpm -r typecheck` y `pnpm -r test` pasan, la documentación afectada está actualizada y, si hubo una decisión no trivial, existe su nota en `docs/decisiones/`.

## Fase 0: arranque

Es la única fase que no es paralela y debe durar una sesión corta. A ya dejó listos, para subir a `main`, el glosario, el contrato v1 y el esqueleto del workspace. B y C los revisan juntos con A durante treinta minutos, corrigen lo que no les cierre y desde ese momento el contrato queda congelado salvo por PR.

La sesión de arranque revisa seis cosas. B confirma que puede con el refresh token rotativo (nota 006, y si es mucho propone una simplificación por PR), con el grafo de dependencias entre módulos (nota 010) y con el script de semilla del demo (nota 008). C confirma la regla de sincronización del contrato (orden de la cola, qué se reintenta y qué no) y cómo va a probar la PWA, dado que el service worker exige HTTPS o `localhost` (nota 002). Los dos revisan los valores por defecto de `docs/decisiones/README.md` y cambian los que no les sirvan. El esqueleto incluye raíz con pnpm, `tsconfig.base.json`, `docker-compose.yml`, los tres paquetes con sus scripts `dev`, `test` y `typecheck`, y un workflow mínimo de CI que ejecuta typecheck y tests en cada PR. Con eso, dos integrantes con poca práctica en Git tienen un repositorio que arranca y un revisor automático desde el primer commit.

## Tareas por rol

### Integrante A (Brayan): arquitectura, contrato e integración

| Tarea | Entregable | Depende de | Desbloquea |
|---|---|---|---|
| A1 Glosario | `docs/glosario.md` | enunciado | B1, C1 |
| A2 Tres escenarios críticos | borrador del ítem 4 | A1 | A3 |
| A3 Contrato v1 | `docs/contrato-api.md` y esquemas en `shared/` | A2 | B3 a B5, C2 a C5 |
| A4 Esqueleto y CI | workspace, compose, paquetes vacíos, workflow | nada | B2, C1 |
| A5 Atributos de calidad y limitaciones | ítems 1 y 2, con cifras | enunciado | A7 |
| A6 Casos de uso | ítem 3, diagramas en Mermaid | A1 | nada |
| A7 Estilo arquitectónico | ítem 5, justificación frente a alternativas | A5 | nada |
| A8 Notas de decisión | ítem 11, una nota por decisión, en continuo | todas | A10 |
| A9 Tecnologías | ítem 10, ensamblado con aportes de B y C | B y C | A10 |
| A10 Integración del documento | `arquitectura.md` coherente con el código, exportado a PDF | todo | entrega |
| A11 Guion de sustentación | recorrido de la demo atado a cada principio | I3 | ensayo |

A también revisa todos los PR y es el único que aprueba cambios al contrato. Estado al cerrar la sesión de A: A1 a A7 y A9 están en borrador dentro del repositorio, A8 avanza con las notas 001 a 010, y quedan abiertos A10 (integración del documento) y A11 (guion de sustentación), que dependen del trabajo de B y C.

### Integrante B (Juan Camilo): backend y datos

| Tarea | Entregable | Depende de | Desbloquea |
|---|---|---|---|
| B1 Modelo de datos | ítems 7 y 8: entidad relación y justificación de PostgreSQL | A1 | B2 |
| B2 Migraciones | SQL numerado de las tablas del demo | B1, A4 | B3 a B5 |
| B3 Módulo `identidad` | login con correo institucional, token de acceso corto, refresh rotativo, roles | A3, B2 | B4, B5 |
| B4 Módulo `programacion` | centros, actividades, programación semanal, consulta del operario, función que deriva el estado de una actividad y script de semilla del demo (`pnpm --filter backend seed`) | A3, B2 | C4, C6 |
| B5 Módulo `evidencias` | recepción idempotente de fotos, tipos antes, durante y después, revisión del supervisor | A3, B2 | C3, C5 |
| B6 Diagrama de componentes | ítem 6, en Mermaid, respetando el grafo de dependencias de la nota 010 | B4, B5 | A10 |
| B7 Pruebas | dominio con repositorios en memoria, adaptadores contra PostgreSQL real, respuestas validadas contra `shared/` | en continuo | I1 |
| B8 Módulos `jornada` y `personal` | solo si sobra tiempo; si no, quedan diseñados y documentados | B5 | nada |

El orden de prioridad es B3, B4, B5 y después lo demás. Si B va justo, A absorbe `identidad` como excepción registrada en una nota de decisión.

### Integrante C (Pablo): cliente móvil y sincronización

| Tarea | Entregable | Depende de | Desbloquea |
|---|---|---|---|
| C1 PWA base | manifiesto, service worker e instalable, sobre el esqueleto de Vite que ya existe; decidir cómo se prueba en un celular real, porque el service worker exige HTTPS o `localhost` | A4 | C2 |
| C2 Almacenamiento y cola | IndexedDB y cola de sincronización idempotente, con UUID generado en el cliente | C1, A3 | C3, C8 |
| C3 Captura de fotos | toma de tres fotos por actividad y compresión antes de encolar | C2 | C8 |
| C4 Pantallas del operario | programación semanal, iniciar y terminar actividad, entrada y salida del centro | A3, C1 | C8 |
| C5 Vista del supervisor | lista de evidencias en tablet, aceptar o rechazar con observación | A3, B5 | I3 |
| C6 Adaptador de correo | envío de la programación semanal por SMTP, probado con Mailpit | B4 | I4 |
| C7 Diagrama de despliegue | ítem 9, en Mermaid | A4 | A10 |
| C8 Prueba sin conexión | escenario automatizado: fotos sin conexión, reconexión, una sola copia en servidor. El demo corre en el portátil con emulación de móvil y modo sin conexión; el celular real es opcional | C2, C3, B5 | I2 |

C empieza contra datos simulados y cambia a la API real a medida que B la publica.

## Puntos de integración

Son cuatro y fijos. Cada uno tiene un criterio verificable, y nadie se detiene esperando uno: se trabaja contra el contrato hasta que llega.

| Punto | Criterio |
|---|---|
| I0 Arranque | B y C clonan, corren `pnpm install` y `pnpm -r typecheck` sin errores; contrato v1 en `main` |
| I1 Contrato probado | B sirve login y programación semanal; C los consume sin datos simulados en al menos una pantalla |
| I2 Sincronización de extremo a extremo | C encola tres fotos sin conexión, reconecta, y el servidor las recibe una sola vez aunque el cliente reintente |
| I3 Revisión | el supervisor acepta o rechaza desde la tablet y el estado queda reflejado en el servidor |
| I4 Ensayo | demo completa de principio a fin en modo avión, con el correo visible en Mailpit y el documento revisado contra el código |

## Cambios al contrato

Después del arranque, un cambio al contrato lo propone quien lo necesita mediante un PR que toca `docs/contrato-api.md` y `shared/` a la vez. A lo aprueba, se une primero, y recién entonces B o C escriben código que dependa de él. Como el compilador falla en el otro paquete, el cambio no puede pasar desapercibido.

## Quién escribe cada ítem del documento

| Ítem | Responsable |
|---|---|
| 1 Atributos de calidad, 2 Limitaciones, 3 Casos de uso | A |
| 4 Escenarios críticos, 5 Estilo arquitectónico | A |
| 6 Componentes | B |
| 7 Entidad relación, 8 Justificación de la base de datos | B |
| 9 Despliegue | C |
| 10 Tecnologías | A, con aportes de B y C |
| 11 Decisiones críticas | A integra; cada quien registra las suyas |

## Si falta tiempo

Se recorta de abajo hacia arriba y nunca el mínimo del taller. Primero `personal` y `jornada` pasan a diseño documentado sin implementación, después `seguimiento` queda como consulta simple sin tiempo real, y la vista del supervisor se reduce a una lista con dos botones. El mínimo intocable es `programacion` y `evidencias` funcionando, con la sincronización sin conexión demostrable y el documento completo.

## Fuera de alcance

La nota 008 fija lo que no se construye en v1: la interfaz web de administración, la edición de una programación publicada, el reenvío de evidencia tras un rechazo, el historial de revisiones, los reportes y las notificaciones push. Esto importa para el reparto: nadie diseña pantallas de administración, y el administrador del demo se representa con el script de semilla y llamadas a la API. En la sustentación se dice desde el principio.

## Riesgos

La sincronización sin conexión es lo más difícil y lo que más se va a querer ver, así que C2 y C3 arrancan apenas exista el esqueleto. B concentra la mayor carga de código y por eso su orden de prioridad está fijado. Los conflictos de Git se reducen con la regla de carpetas con dueño y con PR pequeños. Un contrato que cambia tarde rompe a los otros dos, de ahí el congelamiento tras la fase 0. Las fotos pesadas desbordan la cola en teléfonos de gama baja, por lo que la compresión en el cliente es parte de C3 y no una mejora posterior.
