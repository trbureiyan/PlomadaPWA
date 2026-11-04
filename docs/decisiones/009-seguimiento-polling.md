# 009. Seguimiento por polling

Responsable: A. Estado: tomada.

## Problema encontrado

El enunciado pide control y seguimiento "en momento real" del trabajo de cada operario. Pero los operarios no tienen datos móviles, de modo que lo que el servidor sabe llega cuando sus celulares logran sincronizar, por lotes y con retraso. El tiempo real que se puede ofrecer está acotado por esa sincronización.

## Opciones evaluadas

WebSocket, Server-Sent Events, polling periódico y prescindir del seguimiento.

## Opción seleccionada y por qué

Polling de `GET /seguimiento/dia` cada 10 a 15 segundos desde la vista del supervisor. Un canal de empuje no mejora la frescura real, porque el dato no existe en el servidor antes de que el celular lo sincronice. El polling no necesita infraestructura adicional ni estado de conexiones, y se recupera solo de cualquier corte. La carga es trivial: unos 30 supervisores consultando cada 12 segundos son alrededor de 2.5 peticiones por segundo.

## Consecuencias

"En momento real" significa, en este sistema, casi en tiempo real respecto de lo ya sincronizado, y así se declara en las limitaciones del documento. Si el cliente exigiera empuje, Server-Sent Events es el siguiente paso y reemplaza el polling sin cambiar el modelo de datos.
