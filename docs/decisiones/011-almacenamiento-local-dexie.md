# 011. Almacenamiento local en el cliente PWA con Dexie.js

Responsable: C. Estado: tomada.

## Problema encontrado

Los operarios de mantenimiento locativo trabajan en sótanos y áreas comunes de conjuntos residenciales donde la señal móvil es nula. La aplicación debe almacenar en el dispositivo personal (generalmente celulares de gama media o baja) la programación de la semana, los registros de jornada, las fotografías de evidencia y una cola de peticiones pendientes de subida. Se requiere una solución de almacenamiento local que admita objetos binarios (`Blob`) sin duplicar el consumo de memoria mediante base64, que ofrezca tipado estricto con TypeScript, esquemas declarativos versionados y transacciones atómicas para que el registro de una evidencia y su encolamiento ocurran de forma consistente.

## Opciones evaluadas

1. **`localStorage`**: Limitado a ~5 MB por origen, acceso síncrono que bloquea el hilo principal de la interfaz gráfica y no soporta objetos binarios directamente, obligando a codificar fotos en base64 con una sobrecarga del 33% en tamaño y consumo excesivo de memoria RAM.
2. **IndexedDB nativo / `idb` minimalista**: IndexedDB es el estándar asíncrono del navegador para datos estructurados y binarios sin límite estricto de 5 MB. Sin embargo, su API nativa basada en eventos DOM es propensa a errores, y el wrapper `idb` ofrece únicamente una capa de promesas sin validación de esquemas tipados ni consultas ergonómicas.
3. **`Dexie.js`**: Biblioteca madura y ligera sobre IndexedDB nativo. Provee definición declarativa de tablas e índices, soporte de esquemas versionados, tipado estricto en TypeScript con `EntityTable<T, K>`, almacenamiento directo de `Blob` y soporte nativo de transacciones ACID.

## Opción seleccionada y por qué

Se selecciona **Dexie.js** para gestionar IndexedDB en el frontend.

Respeta el principio _offline-first_ y la regla KISS de la arquitectura:

- Almacena las fotos comprimidas directamente como `Blob` en la tabla `evidenciasLocales`, evitando la penalización de CPU y memoria de base64 en dispositivos de bajos recursos.
- Facilita la creación atómica del recurso local y del elemento en la `colaSincronizacion`.
- Proporciona seguridad de tipos compartida con el paquete `shared`, evitando discrepancias de esquema.
- No introduce servidores ni dependencias pesadas en el cliente, manteniendo el bundle ligero.

## Consecuencias

El almacenamiento local queda encapsulado en `frontend/src/infrastructure/storage/dexie-db.ts`. El motor de sincronización (`motor-sincronizacion.ts`) consume y actualiza las tablas de Dexie de manera predecible, permitiendo que la interfaz responda instantáneamente a las acciones del operario sin depender de la latencia ni de la disponibilidad de la red.
