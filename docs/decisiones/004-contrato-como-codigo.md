# 004. Contrato REST expresado como esquemas zod compartidos

Responsable: A. Estado: tomada.

## Problema encontrado

B implementa la API y C construye el cliente al mismo tiempo. Si el acuerdo entre ambos vive solo en un documento, el desacuerdo sobre un campo o un código de error aparece en la integración, que es cuando más cuesta corregirlo.

## Opciones evaluadas

Un documento en Markdown o una especificación OpenAPI escrita a mano. Una especificación OpenAPI generada desde el código. Tipos de TypeScript compartidos sin validación en ejecución. Esquemas zod en un paquete compartido junto con un documento en prosa. En cuanto al estilo de la API, REST con JSON frente a GraphQL o tRPC.

Un documento o un OpenAPI a mano describen el contrato pero no obligan a nadie a cumplirlo, y se desactualizan sin aviso. Generar OpenAPI exige herramientas adicionales y deja dos modelos de datos que mantener. Los tipos sin validación aseguran la compilación pero no lo que realmente llega por la red, y los datos que vienen del celular, del disco o de una variable de entorno hay que validarlos igual. GraphQL y tRPC no aportan nada a unas 25 rutas, y la subida de fotos en multipart y los `PUT` idempotentes del cliente sin conexión encajan de forma natural en REST.

## Opción seleccionada y por qué

Esquemas zod en `@plomada/shared`, un registro de rutas con método, acceso y prioridad en `shared/src/contrato.ts`, y un documento en prosa en `docs/contrato-api.md`. De una sola definición salen el tipo de TypeScript y la validación en ejecución, y el compilador falla en el otro paquete cuando algo cambia. Una prueba de `shared` verifica que cada ruta del código aparezca en el documento, así que los dos no pueden separarse sin que el CI lo note.

## Consecuencias

Zod viaja en el cliente, con un costo de peso aceptable. Todo cambio de contrato pasa por un PR que A aprueba, lo cual centraliza un punto de decisión; a cambio, el compromiso es revisarlo el mismo día para que no frene a nadie.
