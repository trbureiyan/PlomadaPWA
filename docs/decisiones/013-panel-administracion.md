# 013. Panel de administración web como excepción al alcance v1

Responsable: A. Decisor: Brayan. Estado: tomada.

## Problema encontrado

La nota 008 dejó la interfaz web de administración fuera de v1 y previó que el administrador apareciera en la demostración como llamadas a la API. Mientras tanto, la rama integrada trae un panel web con vistas para los cuatro roles: creación de usuarios y centros, programación semanal, revisión, seguimiento diario, hojas de vida y registro de jornada. Se construyó sin una decisión previa, de modo que el alcance real del código y el alcance escrito divergen, y hay que decidir cuál de los dos se corrige.

## Opciones evaluadas

Retirar el panel y volver al alcance de la nota 008, con el administrador como llamadas a la API. Conservarlo sin registrarlo, lo que deja un alcance sin dueño y una nota 008 que miente. Conservarlo, aprobarlo de forma explícita y acotar lo que implica.

## Opción seleccionada y por qué

Se conserva el panel y se aprueba como excepción al alcance v1. El panel consume rutas que ya existen en el contrato y no agrega ninguna, así que no altera la estructura de módulos ni el contrato. Retirarlo costaría más que mantenerlo, porque las pantallas ya están integradas con la API, y una demostración con un administrador visible es más clara para los evaluadores que una con llamadas sueltas. La aprobación tiene tres límites. No cambia las prioridades: la PWA del operario y la sincronización sin conexión siguen siendo lo que decide la demostración, y ningún trabajo del panel se prioriza sobre un P0 pendiente. Hojas de vida y seguimiento siguen siendo P2 en el contrato. Y no se agrega nada nuevo al panel sin una nota que lo apruebe.

La restricción de que un usuario con rol `operario` tenga correo del dominio `@plomada.local` queda aprobada como regla del contrato (`UsuarioCrear` en `shared`). Escribir el dominio como constante en el esquema es una simplificación aceptada mientras haya una sola organización.

## Consecuencias

La nota 008 conserva su alcance escrito y remite a esta nota para la excepción. La demostración puede mostrar al administrador en pantalla. A cambio, el panel hereda las correcciones pendientes del contrato y de la autorización (nota 014), y lo que falle en él cuenta como defecto del producto. El dominio fijo del correo queda como deuda si el sistema llega a servir a más de una organización.
