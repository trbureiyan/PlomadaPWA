# 015. El contrato no fija el dominio del correo de los operarios

Responsable: A. Decisor: Brayan. Estado: tomada, con tareas pendientes en backend y frontend.

## Problema encontrado

El esquema `UsuarioCrear` de `shared/` exigía que un usuario con rol `operario` tuviera un correo terminado en `@plomada.local`, y la misma regla se repite en el backend (`backend/src/modules/identidad/application/crear-usuario.use-case.ts`) y en el formulario `AdminDashboard.tsx`. La regla entró en los tres sitios con el mismo commit, 6ef0868, cuyo mensaje la presenta como "validación estricta de correo institucional (@plomada.local)". El caso de uso de creación de usuarios existía desde 02dad83 sin ella. Ninguna nota la decidió.

El enunciado pide que a los operarios les llegue por correo la programación semanal y que cada operario tenga un correo institucional. Un correo institucional es uno que la empresa asigna en su propio dominio. `.local` es un sufijo reservado para resolución en redes locales (RFC 6762) y no existe en internet, así que un correo `@plomada.local` no recibe nada fuera de la máquina de desarrollo. La regla sirve para el demo con Mailpit, donde cualquier dirección se acepta, y bloquea el envío real: obliga a que ningún operario tenga su dirección verdadera en el sistema. Además, `docs/arquitectura.md` y las notas no nombran ningún dominio de la empresa, y el contrato no es el lugar donde se conoce.

## Opciones evaluadas

1. Mantener `@plomada.local` en el contrato. Descartada: impide el envío real a los operarios, que es un requisito del enunciado.
2. Reemplazarlo por otro dominio fijo. Descartada: el dominio real de la empresa no se conoce y escribirlo en `shared/` lo vuelve a fijar en código.
3. Validar solo que el correo esté bien formado y dejar la restricción de dominio, si un despliegue la quiere, como configuración del servidor.

## Opción seleccionada y por qué

Opción 3. `UsuarioCrear` en `shared/src/usuarios.ts` valida que el correo esté bien formado, igual para todos los roles, y nada más. Es la regla que cumple el enunciado sin inventar un dominio. La política de qué dominios se aceptan es una decisión de cada despliegue, y pertenece al servidor, no al esquema que comparten el cliente y el servidor. Las pruebas de `shared/src/contrato.test.ts` ya no esperan el rechazo de un correo externo, y comprueban que cualquier correo bien formado sirve en los cuatro roles. `docs/contrato-api.md` queda actualizado.

## Consecuencias

Mientras el backend no cambie, el contrato dice una cosa y el servidor hace otra: el esquema acepta cualquier dominio, pero `CrearUsuarioUseCase` rechaza a un operario cuyo correo no termina en `@plomada.local`, con su error propio. Hasta que se cierren las dos tareas siguientes, crear un operario con un correo real falla en el servidor.

Tarea para Juan Camilo (backend, fuera de las del plan, a coordinar con A): quitar la comparación con `@plomada.local` de `crear-usuario.use-case.ts` y el error `CorreoInstitucionalInvalidoError` si queda sin uso, y adaptar `integration.test.ts` (la prueba "valida obligatoriedad de correo institucional @plomada.local para operarios"). Si se quiere conservar una restricción, que sea una variable de entorno opcional, por ejemplo `DOMINIO_CORREO_OPERARIOS`, sin valor por defecto en el código, y que se documente en `.env.example`.

Tarea para Pablo (frontend): quitar la comparación de `AdminDashboard.tsx` (línea 282) y el texto de ayuda con `@plomada.local`.

La semilla y los correos de demostración conservan `@plomada.local`, porque son datos de desarrollo y Mailpit los recibe. La deuda que queda es que nadie ha definido todavía con qué dominio entrarán los operarios reales: lo define la empresa, no el equipo.
