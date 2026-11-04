# Glosario

Vocabulario común del proyecto. Es el único lugar donde se define qué significa cada término; si una palabra del código, de la API o del documento difiere de esta lista, se corrige el código o se propone el cambio aquí con un PR. La columna del identificador indica el nombre exacto en TypeScript o en la API, que es el que se usa en español para el dominio y en inglés solo para los sufijos técnicos.

## Personas y lugares

| Término | Definición | Identificador |
|---|---|---|
| Conjunto cerrado | Cliente de la empresa: propiedad horizontal que contrata el mantenimiento. Cada uno es un centro de trabajo. | |
| Centro de trabajo | Lugar físico donde se realiza el trabajo, que es el mismo conjunto cerrado. | `CentroTrabajo` |
| Usuario | Persona con acceso al sistema, identificada por su correo institucional. Tiene un rol. | `Usuario` |
| Rol | Lo que un usuario puede hacer. Hay cuatro: administrador, administrativo, supervisor y operario. | `Rol` |
| Administrador | Rol único de la empresa. Gestiona usuarios y programa la semana. | `administrador` |
| Administrativo | Rol de apoyo (unos 20). Programa y consulta, sin gestionar usuarios. | `administrativo` |
| Supervisor | Rol de unos 30 usuarios. Revisa el trabajo en sitio y registra su decisión. | `supervisor` |
| Operario | Rol de unos 150 usuarios. Ejecuta las actividades y sube la evidencia desde su celular personal. | `operario` |

## Trabajo programado

| Término | Definición | Identificador |
|---|---|---|
| Programación semanal | Plan de una semana, de lunes a viernes, con todas las asignaciones. Hay una sola por semana y nace en borrador. | `ProgramacionSemanal` |
| Borrador y publicada | Estados de una programación. Al publicarla se envía el correo a los operarios y deja de editarse. | `EstadoProgramacion` |
| Asignación | Trabajo de un operario en un centro de trabajo durante un día, con una o más actividades. | `Asignacion` |
| Actividad | Tarea concreta dentro de una asignación, como limpiar la piscina o pintar un muro. Es la unidad que se evidencia y se revisa. | `Actividad` |
| Estado de actividad | Pendiente, en curso, finalizada, aprobada o rechazada. Lo deriva el servidor, nunca el cliente. | `EstadoActividad` |

## Evidencia y revisión

| Término | Definición | Identificador |
|---|---|---|
| Evidencia | Foto tomada por el operario como prueba del trabajo, ligada a una actividad. Nunca se modifica. | `Evidencia` |
| Tipo de evidencia | Momento que documenta la foto: antes de empezar, durante el trabajo o después de terminar. | `TipoEvidencia`: `antes`, `durante`, `despues` |
| Revisión | Decisión del supervisor sobre una actividad: aprobada o rechazada, con observación obligatoria al rechazar. | `Revision` |
| Cola de revisión | Actividades con al menos una evidencia y sin revisión. Es la lista de trabajo del supervisor. | `revision=pendiente` |

## Jornada

| Término | Definición | Identificador |
|---|---|---|
| Registro de jornada | Hecho con hora que el operario marca: entrada o salida del centro, inicio o fin de una actividad. | `RegistroJornada` |
| Tipo de registro | Cuál de los cuatro hechos es. | `TipoRegistroJornada`: `entrada_centro`, `salida_centro`, `inicio_actividad`, `fin_actividad` |
| Hora capturada | Momento real del evento según el reloj del celular. | `capturadoEn`, `capturadaEn` |
| Hora recibida | Momento en que el servidor lo recibió. Puede ser horas después de la capturada. | `recibidoEn`, `recibidaEn` |
| Hoja de vida | Datos laborales y de formación de un operario. | `HojaDeVida` |
| Seguimiento | Vista de solo lectura del día: dónde está cada operario y cómo van sus actividades. | `SeguimientoDia` |

## Sincronización

| Término | Definición | Identificador |
|---|---|---|
| Modo sin conexión | El cliente funciona sin internet: lee la programación guardada y registra todo localmente. | |
| Cola de sincronización | Lista local, en el celular, de registros y fotos pendientes de enviar. Sobrevive al cierre de la aplicación. | |
| Sincronizar | Drenar la cola contra el servidor cuando hay conexión, de a un elemento por vez. | |
| Idempotencia | Propiedad de una escritura que, repetida con el mismo contenido, deja el sistema igual que si se hubiera hecho una sola vez. Es lo que evita fotos duplicadas tras un reintento. | `PUT` con UUID del cliente |

## Arquitectura

| Término | Definición | Identificador |
|---|---|---|
| Módulo | Parte del backend con su propio dominio, casos de uso y adaptadores, que solo se comunica con otros por su interfaz pública. | `backend/src/modules/<modulo>/` |
| Dominio | Reglas del negocio, sin dependencias externas. | carpeta `domain/` |
| Caso de uso | Una operación del sistema, como publicar una programación. Un archivo por caso de uso. | carpeta `application/` |
| Puerto | Interfaz que un caso de uso necesita del exterior, como guardar una foto o enviar un correo. | `application/ports/` |
| Adaptador | Implementación concreta de un puerto, como PostgreSQL, disco local o SMTP. | carpeta `infrastructure/` |
| Contrato | Acuerdo entre backend y frontend: esquemas, rutas, roles y reglas. Vive en `shared/` y en `docs/contrato-api.md`. | `@plomada/shared` |
| Prioridad P0, P1, P2 | Qué tan necesaria es una ruta para la demostración: P0 imprescindible, P1 completa el flujo, P2 solo si sobra tiempo. | `Prioridad` |
