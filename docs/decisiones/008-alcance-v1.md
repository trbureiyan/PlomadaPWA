# 008. Alcance mínimo vertical y prioridades P0 a P2

Responsable: A. Estado: tomada.

## Problema encontrado

El enunciado describe un sistema amplio (programación, jornada, evidencias, hojas de vida, seguimiento en tiempo real, correo) y el taller pide poner en funcionamiento al menos dos módulos, con tres personas y poco tiempo. Construir de más pone en riesgo lo esencial, y recortar sin criterio deja huecos que bloquean a otro integrante.

## Opciones evaluadas

Construir todo el enunciado con poca profundidad, recortar módulos completos, o construir un recorrido vertical mínimo que atraviese el cliente, la API y la base de datos, y diseñar el resto sin implementarlo.

## Opción seleccionada y por qué

Recorrido vertical mínimo. Es P0 lo necesario para la demostración: inicio y renovación de sesión, crear y publicar una programación con su correo, la programación del operario, la subida de evidencias con sincronización sin conexión, y la revisión del supervisor. Es P1 lo que completa el flujo: registros de jornada, usuarios y centros, y listados. Es P2 lo que solo se implementa si sobra tiempo: hojas de vida y seguimiento. Todo P1 y P2 queda en el contrato para que nadie tenga que adivinar su forma.

Quedan fuera de v1 y se documentan como limitaciones: la interfaz web de administración, la edición de una programación ya publicada, el reenvío de evidencia tras un rechazo, el historial de revisiones, los reportes y las notificaciones push. Como no hay interfaz de administración, los datos del demo (un administrador, un supervisor, tres operarios, dos centros y una programación) los crea un script de semilla del backend, y la programación se publica llamando a la API. Eso es honesto y suficiente para mostrar los principios que el taller evalúa.

## Consecuencias

En la sustentación el administrador aparece como llamadas a la API y no como una pantalla, y hay que decirlo desde el principio. A cambio, el esfuerzo de C se concentra en lo que más pesa: la PWA del operario y la sincronización.
