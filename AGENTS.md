# AGENTS.md

Instrucciones para agentes de IA que trabajen en Plomada. Léelas completas antes de tocar código y vuelve a ellas cuando una decisión no esté clara.

## Contexto

Plomada gestiona la programación semanal, la jornada y la evidencia fotográfica de unos 150 operarios de mantenimiento locativo en conjuntos cerrados, con revisión de unos 30 supervisores y administración central. Los operarios usan celulares personales de gama baja o media, sin datos móviles y sin garantía de internet en el sitio. Esa restricción domina el diseño: el cliente funciona primero sin conexión y sincroniza después.

El equipo son tres personas. A (Brayan) lleva arquitectura y documentación, B (Juan Camilo) el backend y los datos, C (Pablo) el cliente móvil y la sincronización. Dos de los tres tienen poca experiencia con Git y GitHub, así que explica cada paso de Git en lenguaje llano y no asumas que conocen ramas, rebase o conflictos.

El taller permite usar IA siempre que cada decisión se sustente con los principios del documento de arquitectura. Por eso el código debe ser defendible además de funcional: cuando tomes una decisión de diseño, di en una línea qué principio de `docs/arquitectura.md` la respalda, en el commit o en la descripción del PR.

## Forma de trabajar

Antes de escribir código, orienta: lee `docs/`, este archivo y el módulo afectado. Mapea qué archivos, puertos y tablas toca el cambio. Interroga lo que no esté claro, preguntando al integrante en vez de suponer, porque una pregunta cuesta menos que reescribir. Actúa con el cambio mínimo que resuelve el problema. Al cerrar, actualiza los tests y la documentación que el cambio dejó desactualizados. No entregues código sin cuestionar antes el contexto: versiones de Node y pnpm, estado del esquema de la base, qué dice el contrato vigente.

El criterio general es KISS y YAGNI. La arquitectura hexagonal se aplica donde el límite importa de verdad, que aquí son el acceso a la base de datos, el almacenamiento de fotos, el correo y HTTP. No crees un puerto ni una capa para algo que no tiene un segundo adaptador ni una razón real para cambiar. Un caso de uso de tres líneas no necesita tres clases. Si notas que estás construyendo una estructura elaborada donde una regla simple bastaría, detente y simplifica.

Los comentarios explican el porqué conceptual de una decisión, no repiten lo que el código ya dice, y no se llenan de TSDoc ceremonial: los tipos ya documentan el qué. La prosa en commits, PRs y documentos es seca y directa, sin emojis, sin entusiasmo de relleno y sin resúmenes de lo que acabas de hacer.

Para las pruebas, el dominio y los casos de uso van primero, con repositorios en memoria, y se escriben antes del código cuando el caso lo permite. El repositorio en memoria y el de PostgreSQL implementan la misma interfaz del puerto, y el compilador es quien verifica que sean intercambiables. Los adaptadores se prueban contra el PostgreSQL real del `docker-compose.yml`, nunca con mocks de la base.

## Arquitectura: reglas que no se negocian

El backend es un monolito modular hexagonal. Cada módulo vive en `backend/src/modules/<modulo>/` con tres carpetas: `domain/` (entidades, objetos de valor, errores de dominio), `application/` (un caso de uso por archivo, con los puertos en `application/ports/` declarados como `interface`) e `infrastructure/` (adaptadores: `http/`, `persistence/`, `storage/`, `mail/`). La dependencia apunta en un solo sentido: infraestructura depende de aplicación y aplicación depende de dominio. El dominio no importa Express, `pg`, Nodemailer, `fs` ni ninguna librería externa. Los casos de uso reciben sus puertos por inyección en el constructor o en una función fábrica, y el único lugar donde se conectan con sus adaptadores concretos es `backend/src/composition-root.ts`.

Los módulos son `identidad`, `personal`, `programacion`, `jornada`, `evidencias` y `seguimiento` (este último solo lectura). Un módulo habla con otro únicamente a través de su `index.ts` público. No se importan archivos internos de otro módulo ni se hacen consultas sobre tablas ajenas; cada módulo es dueño de las suyas. Una clave foránea por id hacia otra tabla es aceptable, una consulta que la atraviesa no.

Los módulos forman un grafo sin ciclos: `personal` y `programacion` dependen de `identidad`, `jornada` y `evidencias` dependen de `programacion`, y `seguimiento` lee de `programacion`, `jornada` y `evidencias`. Cuando un módulo necesita algo de otro que ya depende de él, declara un puerto y `composition-root.ts` lo implementa llamando a la interfaz pública del otro; nunca se resuelve con un import cruzado. El caso real es `HechosDeActividad`, que `programacion` declara para devolver el estado de las actividades. La regla que deriva ese estado es una función pura del dominio de `programacion`, expuesta en su `index.ts`. Los detalles están en `docs/decisiones/010-dependencias-entre-modulos.md`.

Cada ruta del contrato lleva una prioridad. P0 es lo necesario para la demostración, P1 completa el flujo y P2 solo se implementa si sobra tiempo. Para la sustentación se ponen en funcionamiento `programacion` y `evidencias`, sobre una versión mínima de `identidad`, y se trabaja en ese orden: no abras trabajo en un P1 mientras quede un P0 sin terminar. Lo que queda fuera de v1 está en `docs/decisiones/008-alcance-v1.md`; no lo construyas sin una nota nueva.

## Contrato, sincronización y seguridad

El contrato entre backend y frontend son dos cosas que cambian juntas: `docs/contrato-api.md`, que explica los endpoints y su semántica, y el paquete `shared/`, que los expresa como esquemas zod y tipos inferidos. Backend y frontend importan de `shared` y nunca redeclaran un tipo de la API por su cuenta. B valida con esos esquemas en el borde HTTP, y C los usa para tipar las llamadas y la cola de sincronización. Un cambio al contrato es un PR propio, aprobado por A, que se une antes del código que lo usa. Si el contrato no existe todavía para lo que te piden, propónlo en esos dos lugares antes de implementar.

Todo endpoint de sincronización es idempotente. El cliente genera el UUID de cada registro y de cada foto, y el servidor lo usa como clave, de modo que reintentar un envío nunca duplica datos. El cliente envía la hora real de captura del evento y el servidor guarda además la hora de recepción, ambas en UTC con formato ISO 8601, porque una foto tomada sin conexión llega horas después y el control de horario depende de saber cuándo ocurrió de verdad. El cliente comprime las fotos antes de encolarlas, con objetivo de unos cientos de kilobytes, y cada actividad admite tres tipos de evidencia: `antes`, `durante` y `despues`. El supervisor acepta o rechaza el trabajo, y un rechazo exige observación. El estado de una actividad no se guarda ni lo envía el cliente: el servidor lo deriva de los hechos registrados con las reglas de `docs/contrato-api.md`.

La autenticación usa correo institucional y contraseña con hash argon2id, un token de acceso de 15 minutos y un refresh token rotativo de 7 días, porque la cola offline sincroniza horas después y renueva la sesión antes de subir. Los roles son administrador, administrativo, supervisor y operario, y el rol se comprueba en el router con `exigirRol`, mientras que la propiedad del recurso (por ejemplo, que una actividad sea del operario que la toca) se decide en la capa de aplicación (nota 014). Los secretos viven solo en `.env`; el repositorio incluye únicamente `.env.example`.

## Convenciones

TypeScript en modo estricto en todos los paquetes, con la configuración compartida en `tsconfig.base.json`, módulos ES y Node 22 o superior. El backend corre con `tsx` y no tiene paso de build. Si el compilador se queja, se corrige el tipo y no se silencia: nada de `any`, `@ts-ignore` ni `as` para callar un error. Los datos que entran por HTTP, por IndexedDB o por variables de entorno llegan como `unknown` y se validan con un esquema antes de convertirse en un tipo conocido; ese es el único lugar donde un cast es legítimo.

El vocabulario de dominio va en español (`Operario`, `Programacion`, `Actividad`, `Evidencia`, `RegistroJornada`) y los sufijos técnicos en inglés (`OperarioRepository` para la interfaz, `PgOperarioRepository` e `InMemoryOperarioRepository` para sus implementaciones). Prettier con configuración por defecto. Las pruebas usan Vitest en todos los paquetes. Cada paquete expone los scripts `dev`, `test` y `typecheck`, y el backend además `migrate`. Los cambios de esquema son migraciones SQL numeradas en `backend/db/migrations/`, nunca ediciones manuales de la base.

El gestor de paquetes es pnpm y solo pnpm: nunca `npm` ni `yarn`, que generan lockfiles que chocan con el del repositorio. `pnpm-lock.yaml` se versiona y no se edita a mano. Antes de dar una tarea por terminada, `pnpm -r typecheck` y `pnpm -r test` deben pasar desde la raíz.

Los diagramas del documento se escriben en D2 en `docs/diagramas/`, empiezan con `...@estilo` y usan solo las clases de `estilo.d2`; la guía está en `docs/diagramas/README.md`. Después de cambiar un `.d2`, regenera su SVG con `pnpm --filter @plomada/docs diagramas` y sube los dos archivos.

Toda decisión crítica se registra en `docs/decisiones/NNN-titulo.md` con tres partes: problema encontrado, opciones evaluadas y opción seleccionada con su porqué. Esas notas alimentan directamente el ítem 11 del documento de arquitectura, así que no las dejes para el final. No añadas dependencias sin justificarlas en esa misma nota, y no introduzcas ORM, colas externas como Redis o RabbitMQ, ni microservicios sin una decisión registrada y aprobada por A. La única dependencia ya aprobada para validar el contrato es zod. Las herramientas que decide B o C dentro de su carpeta (migraciones, multipart, almacenamiento local en el cliente y similares) tienen un valor por defecto en `docs/decisiones/README.md`: úsalo salvo que el integrante decida otra cosa, y si se desvía, registra la nota en el mismo PR.

## Git

Nunca hagas commit en `main`. Nunca ejecutes `push --force`, `rebase`, `reset --hard`, `clean -f` ni borres ramas sin que el integrante lo pida de forma explícita y sin explicarle antes qué va a pasar. Una rama por tarea, nombrada `feat/`, `fix/`, `docs/` o `refactor/` seguido del área y la tarea. Commits pequeños con mensaje `tipo(modulo): descripción` en español e imperativo. Antes de empezar, corre `git status` y `git pull`, y si el pull cambió `pnpm-lock.yaml`, corre `pnpm install`.

Si aparece un conflicto de merge, detente. Explica qué archivos chocan y qué representa cada lado, y espera confirmación antes de resolverlo. No edites carpetas ajenas según la tabla de dueños del README sin avisar. Nunca subas `.env`, `node_modules` ni fotos de prueba.
