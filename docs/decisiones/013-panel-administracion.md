# 013. Panel web de administración como excepción al alcance v1

Responsable: A. Decisor: Brayan. Estado: tomada.

## Problema encontrado

La nota 008 dejó la interfaz web de administración fuera de v1 y clasificó las hojas de vida y el seguimiento como P2. Prevé que el administrador aparezca en la demostración como llamadas a la API y datos de una semilla. El código integrado hace otra cosa: `frontend/src/components/` tiene pantallas para los cuatro roles (`AdminDashboard.tsx`, `AdministrativoDashboard.tsx`, `SupervisorDashboard.tsx` y `OperarioDashboard.tsx`). Las tres primeras suman unas 3600 líneas y cubren creación de usuarios y centros, programación y publicación, hojas de vida, seguimiento diario y registros de jornada. Llegaron en los commits cbb6b01 y 6ef0868, y en el segundo se agregó a la nota 008 una "Ampliación de alcance" que justificaba lo construido, sin pasar por una decisión previa. Además, ese commit cambió dos esquemas de `shared/`: `HojaDeVida` ganó `cursoAlturas` y `vencimientoAlturas` (con la migración `006_alturas_hoja_de_vida.sql`), y `UsuarioCrear` ganó validaciones de nombre, contraseña y dominio de correo. El alcance escrito y el alcance real divergen, y hay que decidir cuál de los dos se corrige.

Dos hechos pesan en la decisión. El enunciado del taller pide los módulos de hojas de vida, el seguimiento en momento real y el control de horario de entrada y salida; no pide una interfaz de administración, pero esos tres módulos solo se pueden mostrar con una pantalla o con llamadas a la API. Y la prueba de ejecución del QA ejerció los endpoints de estos flujos, no las pantallas: la vista del supervisor y los paneles de administrativo y administrador figuran como no ejecutados en su informe.

## Opciones evaluadas

1. Retirar el panel y volver al alcance de la nota 008. Descartada: el plan de correcciones congela el código y no contempla retirar pantallas, y separar lo que sobra de las pantallas que sí sirven sería trabajo no planeado sobre archivos de más de mil líneas.
2. Conservarlo sin registrarlo. Descartada: deja una nota 008 que no describe el sistema, y quien presente no podría explicar de dónde salió ese alcance.
3. Conservarlo y aprobarlo como excepción acotada, con una nota que diga qué cubre y qué no.

## Opción seleccionada y por qué

Opción 3. Se conserva el panel y se aprueba como excepción al alcance v1, por dos razones. Primera, el enunciado pide hojas de vida, seguimiento y control de horario, y el panel es la forma en que esos módulos se ven funcionar. Segunda, el panel usa solo rutas que ya están en `shared/src/contrato.ts`: el contrato no ganó ninguna ruta con él.

También se aprueba, con efecto retroactivo, el cambio de esquemas del commit 6ef0868, salvo la restricción de dominio del correo, que se revierte en la nota 015. El criterio es que un cambio de contrato sin PR previo se acepta después solo si es compatible, está cubierto por pruebas y queda documentado. Los campos de alturas son opcionales, tienen la migración 006 y una prueba de integración en el backend, así que no rompen a quien no los envíe. Las validaciones de `UsuarioCrear` (nombre de al menos 3 caracteres, contraseña inicial de al menos 8 que no sean espacios) endurecen la entrada, pero sus únicos consumidores, el servidor y el panel, ya las aplican, y las cubren las pruebas de `shared`. Quedan en el contrato y en `docs/contrato-api.md`. A partir de ahora, un cambio de contrato sin PR previo aprobado por A no se acepta de nuevo.

La aprobación tiene tres límites. No cambia las prioridades: la PWA del operario y la sincronización sin conexión siguen siendo lo que decide la demostración, y ningún trabajo del panel pasa por delante de un P0 pendiente. Hojas de vida y seguimiento siguen siendo P2 en el contrato. Y no entra nada nuevo al panel sin una nota que lo apruebe.

## Consecuencias

La nota 008 conserva su alcance escrito y remite a esta para la excepción. En la demostración el administrador puede aparecer en pantalla, pero el ensayo (I4) debe ejercer el panel de punta a punta, porque nadie lo ha probado hasta ahora. Si falla, el recorrido de la nota 008 sigue disponible: semilla y llamadas a la API.

La deuda es la que se ve en el código. `AdminDashboard.tsx` y `AdministrativoDashboard.tsx` repiten las mismas llamadas de programación, centros y hojas de vida, y cada una valida los formularios por su cuenta. `cliente-api.ts` acepta un `centroTrabajoId` en `obtenerSeguimientoDia` que el contrato no define (`SeguimientoFiltro` solo tiene `fecha`), aunque ninguna pantalla lo usa. Los defectos que el QA encontró en el cliente del operario no tocan el panel, pero los errores del panel cuentan como defectos del producto. Nada de esto se corrige ahora, porque el plan de correcciones congela las funcionalidades.
