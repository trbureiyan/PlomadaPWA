# 015. El contrato no fija el dominio del correo de los operarios

Responsable: A. Decisor: Brayan. Estado: tomada, con tareas B-8 y C-9 en el plan de correcciones.

## Problema encontrado

El esquema `UsuarioCrear` de `shared/` exigía que un usuario con rol `operario` tuviera un correo terminado en `@plomada.local`, y la misma regla se repite en el backend (`backend/src/modules/identidad/application/crear-usuario.use-case.ts`) y en el formulario `AdminDashboard.tsx`. La regla entró en los tres sitios con el mismo commit, 6ef0868, cuyo mensaje la presenta como "validación estricta de correo institucional (@plomada.local)". El caso de uso de creación de usuarios existía desde 02dad83 sin ella. Ninguna nota la decidió.

El enunciado pide que a los operarios les llegue por correo la programación semanal y que cada operario tenga un correo institucional. Un correo institucional es uno que la empresa asigna en su propio dominio. `.local` es un sufijo reservado para resolución en redes locales (RFC 6762) y no existe en internet, así que un correo `@plomada.local` no recibe nada fuera de la máquina de desarrollo. La regla sirve para el demo con Mailpit, donde cualquier dirección se acepta, y bloquea el envío real: obliga a que ningún operario tenga su dirección verdadera en el sistema. Además, `docs/arquitectura.md` y las notas no nombran ningún dominio de la empresa, y el contrato no es el lugar donde se conoce.

## Opciones evaluadas

1. Mantener `@plomada.local` en el contrato. Descartada: impide el envío real a los operarios, que es un requisito del enunciado.
2. Reemplazarlo por otro dominio fijo. Descartada: el dominio real de la empresa no se conoce y escribirlo en `shared/` lo vuelve a fijar en código.
3. Validar solo que el correo esté bien formado, sin restricción de dominio en el código.
4. Validar el formato y dejar la restricción de dominio como variable de entorno opcional del servidor. Descartada por ahora: nadie ha pedido restringir el dominio, y AGENTS.md pide KISS y YAGNI, es decir, no construir configuración sin un caso real. Si la empresa lo pide, se agrega entonces.

## Opción seleccionada y por qué

Opción 3. `UsuarioCrear` en `shared/src/usuarios.ts` valida que el correo esté bien formado, igual para todos los roles, y nada más. Es la regla que cumple el enunciado sin inventar un dominio. Si algún día hace falta restringir dominios, es una política de cada despliegue y pertenece al servidor, no al esquema que comparten el cliente y el servidor. Las pruebas de `shared/src/contrato.test.ts` ya no esperan el rechazo de un correo externo, y comprueban que cualquier correo bien formado sirve en los cuatro roles. `docs/contrato-api.md` queda actualizado.

## Consecuencias

Mientras el backend no cambie, el contrato dice una cosa y el servidor hace otra: el esquema acepta cualquier dominio, pero `CrearUsuarioUseCase` rechaza a un operario cuyo correo no termina en `@plomada.local`, con su error propio. Hasta que se cierren las dos tareas siguientes, crear un operario con un correo real falla en el servidor.

Tarea B-8 del plan de correcciones, para Juan Camilo: quitar la comparación con `@plomada.local` de `crear-usuario.use-case.ts`, el error `CorreoInstitucionalInvalidoError` y su manejo si quedan sin uso, y adaptar la prueba de `integration.test.ts` que hoy espera el rechazo. No se agrega ninguna variable de entorno.

Tarea C-9 del plan de correcciones, para Pablo: quitar la comparación de `AdminDashboard.tsx` (línea 282) y los textos de ayuda que nombran el dominio.

La semilla y los correos de demostración conservan `@plomada.local`, porque son datos de desarrollo y Mailpit los recibe. La deuda que queda es que nadie ha definido con qué dominio entrarán los operarios reales: lo define la empresa, no el equipo, y mientras tanto el sistema acepta cualquiera.
