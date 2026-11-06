# 014. Autorización por rol en el router, desvío de AGENTS.md

Responsable: A. Decisor: Brayan. Estado: tomada, con deuda.

## Problema encontrado

AGENTS.md dice que los roles son administrador, administrativo, supervisor y operario, y que la autorización se decide en la capa de aplicación y no en el router. El código la decide en los routers. Cada ruta de los seis módulos con HTTP declara sus roles con `exigirRol(...)`, un middleware único en `backend/src/infrastructure/http/auth.middleware.ts` que responde 403 `sin_permiso` antes de llegar al caso de uso. Ningún caso de uso recibe ni comprueba el rol de quien llama. El plan de correcciones lo registra como hallazgo H-06 (sección 5) y lo deja como desvío aceptado (sección 8). Hay que fijar la decisión y su razón.

Distinguir dos cosas ayuda a acotar el desvío. La regla sobre el rol dice quién puede llamar a una ruta. La regla sobre el recurso dice sobre qué datos puede actuar quien llama. La segunda ya vive en la capa de aplicación en `evidencias`: `subir-evidencia.use-case.ts` rechaza con `SinPermisoError` a un operario que no tiene asignada la actividad. En `jornada` falta, y el plan lo corrige en la tarea B-2.

## Opciones evaluadas

1. Mover la comprobación del rol a cada caso de uso, que recibiría el actor como parámetro. Es lo que dice AGENTS.md. Obliga a tocar los casos de uso de los seis módulos y sus pruebas.
2. Mantener la comprobación en el router y registrar el desvío.
3. Comprobar en las dos capas. Descartada: duplica la regla y obliga a mantenerla coherente en dos sitios.

## Opción seleccionada y por qué

Opción 2. La regla por rol es una tabla por ruta, declarativa y visible en una línea junto a la ruta, y se contrasta con la columna de acceso de `docs/contrato-api.md`. El único punto de ejecución es el middleware compartido. La prueba de ejecución del QA recorrió las 20 rutas no públicas del registro: todas exigieron token y cada ruta restringida respondió 403 a los roles no permitidos. Las pruebas del backend cubren además algunos casos de 403 (`contrato-http.test.ts`, `integration.test.ts`), pero no la matriz completa. Mover la regla a los casos de uso es un cambio amplio con un beneficio que hoy no se necesita, mientras el plan de correcciones congela todo lo que no esté en él, y el criterio de AGENTS.md es el cambio mínimo.

El desvío no cubre la propiedad del recurso. Esa comprobación debe estar en la capa de aplicación, y `jornada` es el caso pendiente (tarea B-2 del plan).

## Consecuencias

Los casos de uso confían en que el router ya filtró por rol. Si aparece otro punto de entrada, como un proceso programado o un script, hay que repetir la comprobación o mover la regla a la capa de aplicación; esa es la deuda. Las pruebas unitarias de los casos de uso no pueden verificar permisos por rol, porque no los conocen, y la cobertura de roles depende de las pruebas HTTP.

AGENTS.md sigue diciendo otra cosa. Mientras no se edite, esta nota es el registro de la excepción. Si el equipo decide que el desvío es definitivo, la corrección de AGENTS.md es un cambio propio, que decide Brayan.
