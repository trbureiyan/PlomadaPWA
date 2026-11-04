# AGENTS.md

Instrucciones para agentes de IA que trabajen en Plomada. Léelas completas antes de tocar código y vuelve a ellas cuando una decisión no esté clara.

## Contexto

Plomada gestiona la programación semanal, la jornada y la evidencia fotográfica de unos 150 operarios de mantenimiento locativo en conjuntos cerrados, con revisión de unos 30 supervisores y administración central. Los operarios usan celulares personales de gama baja o media, sin datos móviles y sin garantía de internet en el sitio. Esa restricción domina el diseño: el cliente funciona primero sin conexión y sincroniza después.

El equipo son tres personas. A lleva arquitectura y documentación, B el backend y los datos, C el cliente móvil y la sincronización. Dos de los tres tienen poca experiencia con Git y GitHub, así que explica cada paso de Git en lenguaje llano y no asumas que conocen ramas, rebase o conflictos.

El taller permite usar IA siempre que cada decisión se sustente con los principios del documento de arquitectura. Por eso el código debe ser defendible además de funcional: cuando tomes una decisión de diseño, di en una línea qué principio de `docs/arquitectura.md` la respalda, en el commit o en la descripción del PR.

## Forma de trabajar

Antes de escribir código, orienta: lee `docs/`, este archivo y el módulo afectado. Mapea qué archivos, puertos y tablas toca el cambio. Interroga lo que no esté claro, preguntando al integrante en vez de suponer, porque una pregunta cuesta menos que reescribir. Actúa con el cambio mínimo que resuelve el problema. Al cerrar, actualiza los tests y la documentación que el cambio dejó desactualizados. No entregues código sin cuestionar antes el contexto: versión de Node, estado del esquema de la base, qué dice el contrato vigente.

El criterio general es KISS y YAGNI. La arquitectura hexagonal se aplica donde el límite importa de verdad, que aquí son el acceso a la base de datos, el almacenamiento de fotos, el correo y HTTP. No crees un puerto ni una capa para algo que no tiene un segundo adaptador ni una razón real para cambiar. Un caso de uso de tres líneas no necesita tres clases. Si notas que estás construyendo una estructura elaborada donde una regla simple bastaría, detente y simplifica.

Los comentarios explican el porqué conceptual de una decisión, no repiten lo que el código ya dice, y no se llenan de JSDoc ceremonial. La prosa en commits, PRs y documentos es seca y directa, sin emojis, sin entusiasmo de relleno y sin resúmenes de lo que acabas de hacer.

Para las pruebas, el dominio y los casos de uso van primero, con repositorios en memoria, y se escriben antes del código cuando el caso lo permite. Los adaptadores se prueban contra el PostgreSQL real del `docker-compose.yml`, nunca con mocks de la base.

## Arquitectura: reglas que no se negocian

El backend es un monolito modular hexagonal. Cada módulo vive en `backend/src/modules/<modulo>/` con tres carpetas: `domain/` (entidades, objetos de valor, errores de dominio), `application/` (un caso de uso por archivo, con los puertos en `application/ports/`) e `infrastructure/` (adaptadores: `http/`, `persistence/`, `storage/`, `mail/`). La dependencia apunta en un solo sentido: infraestructura depende de aplicación y aplicación depende de dominio. El dominio no importa Express, `pg`, Nodemailer, `fs` ni ninguna librería externa. Los casos de uso reciben sus puertos por inyección en el constructor o en una función fábrica, y el único lugar donde se conectan con sus adaptadores concretos es `backend/src/composition-root.js`.

Los módulos son `identidad`, `personal`, `programacion`, `jornada`, `evidencias` y `seguimiento` (este último solo lectura). Un módulo habla con otro únicamente a través de su `index.js` público. No se importan archivos internos de otro módulo ni se hacen consultas sobre tablas ajenas; cada módulo es dueño de las suyas. Una clave foránea por id hacia otra tabla es aceptable, una consulta que la atraviesa no.

Para la sustentación se ponen en funcionamiento `programacion` y `evidencias`, sobre una versión mínima de `identidad`. Prioriza esos tres antes de abrir trabajo en los demás.

## Contrato, sincronización y seguridad

`docs/contrato-api.md` es la fuente de verdad entre backend y frontend. B lo implementa, C lo consume, y un cambio al contrato es un PR propio, aprobado por A, que se une antes del código que lo usa. Si el contrato no existe todavía para lo que te piden, propónlo en ese archivo antes de implementar.

Todo endpoint de sincronización es idempotente. El cliente genera el UUID de cada registro y de cada foto, y el servidor lo usa como clave, de modo que reintentar un envío nunca duplica datos. El cliente envía la hora real de captura del evento y el servidor guarda además la hora de recepción, ambas en UTC con formato ISO 8601, porque una foto tomada sin conexión llega horas después y el control de horario depende de saber cuándo ocurrió de verdad. El cliente comprime las fotos antes de encolarlas, con objetivo de unos cientos de kilobytes, y cada actividad admite tres tipos de evidencia: `antes`, `durante` y `despues`. El supervisor acepta o rechaza el trabajo con una observación opcional.

La autenticación usa correo institucional y contraseña con hash (argon2 o bcrypt) y JWT de vida corta. Los roles son administrador, administrativo, supervisor y operario, y la autorización se decide en la capa de aplicación, no en el router. Los secretos viven solo en `.env`; el repositorio incluye únicamente `.env.example`.

## Convenciones

Node 22 o superior, JavaScript con módulos ES, sin TypeScript por ahora. El vocabulario de dominio va en español (`Operario`, `Programacion`, `Actividad`, `Evidencia`, `RegistroJornada`) y los sufijos técnicos en inglés (`OperarioRepository`, `EvidenciaController`). Prettier con configuración por defecto. Cada carpeta con código expone los scripts `dev` y `test`, y el backend además `migrate`. Los cambios de esquema son migraciones SQL numeradas en `backend/db/migrations/`, nunca ediciones manuales de la base.

Toda decisión crítica se registra en `docs/decisiones/NNN-titulo.md` con tres partes: problema encontrado, opciones evaluadas y opción seleccionada con su porqué. Esas notas alimentan directamente el ítem 11 del documento de arquitectura, así que no las dejes para el final. No añadas dependencias sin justificarlas en esa misma nota, y no introduzcas ORM, colas externas como Redis o RabbitMQ, ni microservicios sin una decisión registrada y aprobada por A.

## Git

Nunca hagas commit en `main`. Nunca ejecutes `push --force`, `rebase`, `reset --hard`, `clean -f` ni borres ramas sin que el integrante lo pida de forma explícita y sin explicarle antes qué va a pasar. Una rama por tarea, nombrada `feat/`, `fix/`, `docs/` o `refactor/` seguido del área y la tarea. Commits pequeños con mensaje `tipo(modulo): descripción` en español e imperativo. Antes de empezar, corre `git status` y `git pull`.

Si aparece un conflicto de merge, detente. Explica qué archivos chocan y qué representa cada lado, y espera confirmación antes de resolverlo. No edites carpetas ajenas según la tabla de dueños del README sin avisar. Nunca subas `.env`, `node_modules` ni fotos de prueba.
