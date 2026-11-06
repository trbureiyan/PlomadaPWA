# 014. Autorización por rol en el router, desvío de AGENTS.md

Responsable: A. Decisor: Brayan. Estado: tomada, con deuda.

## Problema encontrado

AGENTS.md dice que la autorización se decide en la capa de aplicación y no en el router. El código implementado la decide en los routers de cada módulo, con el middleware `exigirRol(...)` de `backend/src/infrastructure/http/auth.middleware.ts`: cada ruta declara los roles permitidos y el middleware responde `sin_permiso` antes de invocar el caso de uso. Los casos de uso no reciben el rol del usuario. La auditoría lo registró como hallazgo H-06. Hay que decidir si se reescribe o se acepta el desvío.

## Opciones evaluadas

Mover la comprobación de rol a cada caso de uso, que recibiría el actor como parámetro. Mantener la comprobación en el router y documentar el desvío. Duplicar la comprobación en las dos capas.

## Opción seleccionada y por qué

Se mantiene la autorización por rol en el router y se acepta como desvío de AGENTS.md. Es una regla de acceso por ruta, declarativa y visible en una sola línea, que se puede contrastar ruta por ruta con la matriz de roles de `docs/contrato-api.md`; la prueba de ejecución del QA lo hizo y las 20 rutas protegidas respondieron como el contrato manda. Mover cada comprobación a los casos de uso es un cambio que toca todos los módulos para un beneficio que hoy no se necesita, y contradice el criterio de cambio mínimo y KISS. El límite es explícito: la regla sobre el rol vive en el router, pero la regla sobre el recurso, como que un operario solo registre jornada o evidencia sobre actividades que le fueron asignadas, es lógica de negocio y debe decidirse en la capa de aplicación.

## Consecuencias

Los casos de uso no se pueden invocar con un rol equivocado desde otro adaptador distinto de HTTP sin repetir la comprobación, y es la deuda de este desvío: si aparece un segundo punto de entrada, hay que mover la regla. Las comprobaciones de propiedad del recurso no están cubiertas por este desvío y quedan pendientes de corrección en el backend, en particular en el registro de jornada. AGENTS.md conserva su regla; si el equipo decide que el desvío es definitivo, se corrige allí en un PR propio.
