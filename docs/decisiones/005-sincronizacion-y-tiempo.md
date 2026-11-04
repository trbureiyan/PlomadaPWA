# 005. Escrituras idempotentes con UUID del cliente, dos horas por evento y estado derivado

Responsable: A. Estado: tomada.

## Problema encontrado

Las fotos y los registros nacen sin conexión y llegan al servidor horas después. Un corte de red a mitad de un envío deja al cliente sin saber si el servidor lo recibió, y repetirlo no puede producir una segunda foto. Además, el reloj de un celular personal no es fiable, y el control de horario del operario depende de saber cuándo ocurrió cada hecho.

## Opciones evaluadas

Para el envío, un endpoint de sincronización por lotes, un `POST` por recurso con identificador asignado por el servidor, un `PUT` por recurso con UUID generado en el cliente, o una biblioteca de sincronización con replicación (PouchDB, RxDB). Para el tiempo, fiarse de la hora del celular, fiarse de la hora del servidor o guardar ambas.

El lote falla completo si una sola foto pesada se corta, y obliga al servidor a manejar éxito parcial. El `POST` con id del servidor tiene justo el problema que hay que evitar: si la respuesta se pierde, el cliente reintenta y se crea un duplicado. Las bibliotecas de replicación resuelven más de lo necesario e imponen su propia base de datos en ambos lados.

## Opción seleccionada y por qué

`PUT` individual sobre un UUID que el cliente genera al capturar. El servidor responde 201 la primera vez, 200 si ya lo tiene con el mismo contenido y `conflicto` si el contenido difiere, de modo que reintentar siempre es seguro y el servidor no guarda estado de sesiones de sincronización. Un fallo afecta a un solo elemento, y el cliente puede insistir en ese sin repetir el resto.

Cada hecho guarda dos horas, `capturadoEn` (la del celular, en el instante del evento) y `recibidoEn` (la del servidor), las dos en UTC, sin corregir ninguna. Mostrar las dos al supervisor es más honesto que adivinar cuál es la buena.

El estado de una actividad no se almacena: se deriva de los hechos registrados con reglas fijas (ver `docs/contrato-api.md`). Así el resultado no depende del orden de llegada, y una foto `despues` que llega antes que la `antes` produce el mismo estado final.

## Consecuencias

El cliente drena la cola de a un elemento, lo cual es más lento que un lote en un enlace bueno pero mucho más robusto en uno malo. Un reloj muy desajustado produce un `capturadoEn` dudoso que el sistema no detecta ni corrige; es una limitación asumida y documentada.
