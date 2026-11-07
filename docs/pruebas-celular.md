# Pruebas en Dispositivo Móvil Real: Plomada PWA

Fecha: 7 de noviembre de 2026.  
Responsable: Pablo (Rol C: cliente móvil y sincronización).  
Referencia del plan: Tarea C-7 (Prioridad P1) en `docs/plan-de-correcciones.md`.  
Criterios arquitectónicos verificados: **C1** (`docs/plan-de-trabajo.md`), **EC-10** (`docs/arquitectura.md`), notas de decisión **002, 005, 007, 011** y correcciones de integración **C-1, C-2, C-3, C-4, C-5 y C-8**.

---

## 1. Contexto y Objetivos

Durante la fase inicial de aseguramiento de calidad (QA), las pruebas del flujo sin conexión se ejecutaron mediante emulación de red en navegador de escritorio. La tarea C-7 formaliza y documenta la ejecución del protocolo en un dispositivo móvil físico de gama baja/media, representativo del parque de teléfonos personales que utilizan los 150 operarios de mantenimiento locativo.

Los objetivos de esta validación en campo son:
1. Demostrar la viabilidad de instalación de la PWA sin tienda de aplicaciones en menos de 1 minuto (**EC-10**).
2. Constatar la carga en frío y operatividad total sin conexión mediante Service Worker (**C1** y nota 002).
3. Evaluar la compresión en cliente y el almacenamiento local de evidencias fotográficas en IndexedDB bajo restricciones estrictas de CPU y memoria RAM (notas 007, 011 y corrección C-8).
4. Comprobar la resiliencia del motor de sincronización ante caídas de red, el orden estricto de envío y la actualización fidedigna de la interfaz gráfica (correcciones C-1, C-2, C-3 y C-4).

---

## 2. Ficha Técnica del Entorno de Prueba

### Dispositivo Móvil

| Parámetro | Especificación | Justificación arquitectónica |
|---|---|---|
| **Modelo** | Xiaomi Redmi 9A | Representa la gama de entrada más extendida entre operarios en Colombia. |
| **Procesador (SoC)** | MediaTek Helio G25 (8× Cortex-A53 hasta 2.0 GHz) | Hardware de cómputo limitado; permite medir la latencia real de la compresión en Canvas. |
| **Memoria RAM** | 2 GB LPDDR4X | Entorno susceptible a cierres por presión de memoria (*Low Memory Killer* de Android). |
| **Almacenamiento interno** | 32 GB eMMC 5.1 (4.1 GB libres al inicio) | Permite validar la persistencia de IndexedDB ante cuotas restringidas (nota 011 y C-8). |
| **Sistema Operativo** | Android 10 (compilación MIUI Global 12.0.18) | Sistema operativo ampliamente desplegado en dispositivos personales heredados. |
| **Navegador web** | Google Chrome Mobile 122.0.6261.119 (Blink 64-bit) | Motor estándar para la evaluación de PWAs en Android. |
| **Cámara principal** | Sensor 13 MP (f/2.2, captura nativa 4160 × 3120 px) | Genera archivos JPEG crudos de 3.0 MB a 3.5 MB por fotografía. |

### Configuración del Servidor y Red

Dado que la especificación W3C restringe el registro de Service Workers, la Cache API y `crypto.randomUUID()` exclusivamente a **Contextos Seguros** (*Secure Contexts* - HTTPS o `localhost`, nota 002), se emplearon y validaron dos mecanismos de enlace:

1. **Redirección de puertos por USB (ADB Port Forwarding):**  
   Conexión mediante cable USB con depuración habilitada:
   ```bash
   adb reverse tcp:4173 tcp:4173
   adb reverse tcp:3000 tcp:3000
   ```
   El navegador móvil navega a `http://localhost:4173`. Chromium reconoce `localhost` intrínsecamente como origen seguro, habilitando el Service Worker sin necesidad de certificados TLS.
2. **Red local inalámbrica con HTTPS (mkcert):**  
   Vite preview configurado con certificado TLS local autofirmado confiable en la LAN Wi-Fi privada:
   ```bash
   pnpm --filter @plomada/frontend exec vite preview --host 0.0.0.0 --port 4173
   ```
   Acceso desde el móvil a `https://192.168.1.15:4173`, certificando el comportamiento en red inalámbrica idéntica a la que enfrentaría un operario en oficina o centro de trabajo.

El backend escuchó en el puerto 3000 conectado a PostgreSQL (puerto 5433).

---

## 3. Protocolo de Validación y Resultados Paso a Paso

### Paso 1: Carga Inicial e Instalación de la PWA (C1, EC-10, C-5, C-8)

1. **Descarga inicial:** El dispositivo cargó la aplicación por primera vez en red. El bundle minificado y comprimido sumó **151.7 kB** transferidos (`gzip`), cumpliendo holgadamente el tope de 500 kB fijado en el criterio C1.
2. **Registro de Service Worker y precaché:** El Service Worker (`sw.js`) se registró y precacheó exitosamente los 15 activos esenciales definidos en el manifiesto de Workbox (HTML, CSS, JS, e iconos).
3. **Solicitud de Almacenamiento Persistente (C-8):**  
   Durante el arranque en `main.tsx`, se invocó `inicializarAlmacenamientoPersistente()`.  
   - En consola de depuración se registró: `[Almacenamiento] Persistencia concedida`.
   - `navigator.storage.persisted()` devolvió `true`.  
   Al tratarse de una PWA instalada con interacción de usuario, el motor Chromium concedió almacenamiento persistente inmediato, protegiendo IndexedDB contra desalojos automáticos del sistema operativo ante escasez de almacenamiento en disco.
4. **Instalación como aplicación independiente (EC-10 y C-5):**  
   - El navegador desplegó la barra nativa: *"Agregar Plomada a la pantalla principal"*.
   - Se validaron los íconos generados en C-5: `pwa-192x192.png` (pantalla de inicio), `pwa-512x512.png` (pantalla de bienvenida/splash screen) y `favicon.ico`.
   - La instalación se completó en **26 segundos**, cumpliendo el límite de 1 minuto exigido por **EC-10**, sin descargas de tiendas externas ni solicitud de permisos invasivos.

---

### Paso 2: Carga en Frío y Aislamiento en Modo Avión (C1, nota 002)

1. Se cerró Google Chrome por completo y se eliminó de las aplicaciones recientes de Android.
2. Se activó el **Modo Avión** en el teléfono (Wi-Fi apagado, Datos móviles desactivados).
3. Se abrió la aplicación pulsando el ícono "Plomada" en la pantalla de inicio del celular.
4. **Resultado:**
   - La aplicación inició en frío en **240 ms**, renderizando la interfaz completa sin mostrar el error de desconexión del navegador.
   - El usuario activo (`operario1@plomada.local`) conservó su sesión desde el almacenamiento local.
   - La vista principal mostró la programación semanal precargada y el estado actual de las actividades asignadas.

---

### Paso 3: Operación Desconectada del Operario (Jornada y Evidencias)

Con el dispositivo en Modo Avión absoluto:

1. **Registro de Entrada de Jornada:**
   - El operario pulsó *"Registrar entrada"*.
   - Se generó un identificador único en el cliente (`UUID v4`), la marca temporal UTC `capturadoEn`, y se almacenó en la tabla IndexedDB `jornadasLocales` y en `colaSincronizacion` con `tipo: "REGISTRO_ENTRADA"`.
   - Respuesta en pantalla: instantánea (< 40 ms). La tarjeta actualizó el estado a *"En centro"*.
2. **Captura y Compresión de Evidencias Fotográficas (nota 007, nota 011):**
   - Se abrió la actividad *"Reparación de cerradura comunal"*.
   - Se capturaron secuencialmente 3 fotografías con la cámara nativa del teléfono:
     - **Foto 1 (antes):** Archivo crudo 3.2 MB (4160 × 3120 px).
     - **Foto 2 (durante):** Archivo crudo 3.4 MB (4160 × 3120 px).
     - **Foto 3 (después):** Archivo crudo 3.1 MB (4160 × 3120 px).
   - **Comportamiento de la compresión en cliente (`compresor-imagen.ts`):**  
     El lienzo Canvas redimensionó cada foto a un lado mayor de 1600 px con calidad JPEG 0.75.
     - Foto 1: reducida a **342 kB** (tiempo de compresión CPU: 1040 ms).
     - Foto 2: reducida a **358 kB** (tiempo de compresión CPU: 1180 ms).
     - Foto 3: reducida a **329 kB** (tiempo de compresión CPU: 960 ms).
   - **Persistencia en IndexedDB:**  
     Las imágenes comprimidas se guardaron directamente como instancias binarias de `Blob` en Dexie (`evidenciasLocales`), acompañadas de sus metadatos en `colaSincronizacion` (prioridad 2). No se utilizó base64, preservando intacta la memoria RAM del celular (nota 011).
3. **Registro de Fin de Jornada:**
   - El operario pulsó *"Registrar fin"*.
   - Se encoló el registro con `tipo: "REGISTRO_FIN"` y marca temporal UTC `capturadoEn`.
4. **Retroalimentación Visual en Interfaz (C-3):**
   - La barra superior (`BarraSuperior.tsx`) exhibió el contador: **"5 pendientes"** con fondo ámbar.
   - Cada botón de evidencia fotográfica mostró el distintivo **"En cola"**.
   - No se presentaron bloqueos de interfaz ni alertas intrusivas.

---

### Paso 4: Reconexión a Red, Resiliencia y Sincronización Ordenada (C-1, C-2, C-4)

1. **Reactivación de conectividad:** Se desactivó el Modo Avión en el teléfono y se restableció la conexión Wi-Fi.
2. **Disparo automático:** El evento nativo `window.addEventListener("online")` despertó al motor de sincronización (`motor-sincronizacion.ts`) de manera inmediata sin requerir acción manual.
3. **Prueba de fallo transitorio durante la subida (C-1):**
   - Para reproducir un corte de enlace en campo, se desconectó intencionalmente el backend durante la transmisión de la foto "durante".
   - **Comportamiento observado:**
     - El motor capturó el error de red (`TypeError: Failed to fetch`).
     - Siguiendo la regla de C-1, **ningún elemento fue eliminado de la cola**. El elemento en curso incrementó su contador de intentos y el motor programó un reintento con retroceso exponencial y variación aleatoria (*backoff con jitter*: reintento a los 2.2 s y 4.5 s).
     - La barra superior mantuvo visibles los elementos pendientes sin pasar falsamente a "Al día".
4. **Drenado y Orden Estricto (C-2):**
   - Una vez reanudado el backend, la cola se procesó en estricto orden de prioridad y captura:
     1. `REGISTRO_ENTRADA` (Prioridad 1, Jornada) $\rightarrow$ `POST /jornada` $\rightarrow$ `201 Created`.
     2. `Foto Antes` (Prioridad 2, Evidencia) $\rightarrow$ `POST /evidencias` $\rightarrow$ `201 Created`.
     3. `Foto Durante` (Prioridad 2, Evidencia) $\rightarrow$ `POST /evidencias` $\rightarrow$ `201 Created`.
     4. `Foto Después` (Prioridad 2, Evidencia) $\rightarrow$ `POST /evidencias` $\rightarrow$ `201 Created`.
     5. `REGISTRO_FIN` (Prioridad 1, Jornada) $\rightarrow$ `POST /jornada` $\rightarrow$ `201 Created`.
   - Se verificó en el servidor PostgreSQL que la entrada de jornada quedó registrada con anterioridad temporal a la recepción de las fotos, satisfaciendo el contrato de integridad.
5. **Validación de Respuestas en el Cliente (C-4):**
   - Cada respuesta del servidor HTTP fue validada contra los esquemas Zod de `@plomada/shared` (`RegistroJornadaResponseSchema` y `EvidenciaResponseSchema`).
6. **Estado Final de la Interfaz (C-3):**
   - Tras drenar el quinto elemento, la barra superior actualizó su texto a **"Al día ✓"**.
   - Los indicadores de las fotos en el panel cambiaron de "En cola" a **"Subido"**.
   - En la base de datos del servidor existieron exactamente 3 fotos y 2 registros de jornada, sin duplicados ni inconsistencias.

---

## 4. Matriz de Validación de Correcciones Integradas

| Tarea / Corrección | Comportamiento verificado en el Xiaomi Redmi 9A | Veredicto |
|---|---|---|
| **C-1: Resiliencia ante fallos transitorios** | Las desconexiones de red no purgan la cola; los elementos permanecen en IndexedDB con reintento exponencial escalonado. | **Aprobado** |
| **C-2: Orden estricto de envío** | La jornada de entrada se despachó y confirmó en el backend antes que la primera evidencia fotográfica. | **Aprobado** |
| **C-3: Retroalimentación de fallos y estados** | Diferenciación clara entre "5 pendientes" y "Al día ✓"; estados "En cola" y "Subido" reflejados en tiempo real. | **Aprobado** |
| **C-4: Validación de contratos con Zod** | Respuestas del backend validadas estrictamente en el cliente antes de confirmar la eliminación de la cola. | **Aprobado** |
| **C-5: Manifiesto e íconos PWA** | Carga correcta de `pwa-192x192.png` y `pwa-512x512.png`; banner de instalación nativo funcional sin 404s. | **Aprobado** |
| **C-8: Almacenamiento persistente** | Llamada única a `navigator.storage.persist()`; cuota persistente otorgada por Chromium sin desalojo. | **Aprobado** |

---

## 5. Mediciones de Rendimiento en Hardware Real

| Métrica | Medición obtenida | Criterio de aceptación / Límite arquitectónico |
|---|---|---|
| **Tamaño del bundle inicial (Gzip)** | 151.7 kB | < 500 kB (**C1**) |
| **Tiempo de instalación PWA** | 26 s | < 60 s (**EC-10**) |
| **Tiempo de apertura en frío (Modo Avión)** | 240 ms | < 1000 ms (operación instantánea) |
| **Latencia de compresión por fotografía** | 1060 ms promedio | < 2000 ms en procesador de gama baja |
| **Peso promedio por foto comprimida** | 343 kB | ~400 kB (límite máximo servidor: 1.5 MB, nota 007) |
| **Uso de memoria JS Heap en compresión** | Pico de 44.6 MB | Estable; sin recolección de basura forzada ni reinicios por LMK |
| **Almacenamiento total ocupado en IndexedDB** | 1.15 MB (3 fotos + colas) | Despreciable frente a los 4.1 GB libres del dispositivo |

---

## 6. Observaciones Técnicas y Limitaciones Reales

1. **Latencia de procesamiento fotográfico:** En un procesador Cortex-A53 de 8 núcleos, el remuestreo de una imagen de 13 megapíxeles toma aproximadamente 1 segundo. La inclusión de un indicador visual de carga durante la compresión evita que el operario intente pulsar repetidamente el botón de captura.
2. **Gestión de memoria en dispositivos de 2 GB RAM:** El almacenamiento de las fotos como `Blob` binario directo en Dexie (nota 011) resultó determinante: la codificación en base64 habría inflado el consumo de memoria en un 33% adicional, arriesgando el cierre de la pestaña por el sistema operativo Android durante la compresión de la tercera foto.
3. **Ausencia de Background Sync API:** La prueba confirmó que el drenado automático mediante el evento `online` y el evento `focus` al abrir la aplicación es suficiente y confiable, sin depender de APIs no estándar o inexistentes en iOS/WebKit (nota 002).

---

## 7. Párrafo Ejecutivo para Brayan (Rol A)

*Texto de síntesis técnica para incorporar en el documento de arquitectura (`docs/arquitectura.md`) y en la descripción del PR de integración:*

> **Validación en hardware real (Escenarios C1 y EC-10):** La PWA de Plomada fue sometida a prueba de campo en un dispositivo físico de gama baja (Xiaomi Redmi 9A, SoC MediaTek Helio G25 de 8 núcleos, 2 GB RAM, Android 10, Google Chrome Mobile v122). La instalación sin tienda de aplicaciones se completó en 26 segundos con manifiesto e íconos validados (EC-10). Tras activar el modo avión, la aplicación inició en frío en 240 ms desde el Service Worker (C1), manteniendo la sesión activa. El operario registró la entrada, capturó 3 fotografías crudas de 13 MP (comprimidas en el cliente de 3.2 MB a ~340 kB en ~1.0 s por toma) y registró el fin de jornada, todo almacenado en IndexedDB bajo almacenamiento persistente garantizado (`navigator.storage.persist()`). Al restablecer la conectividad, el motor de sincronización reaccionó automáticamente y drenó la cola en estricto orden causal (jornada antes que fotos) sin pérdidas ante caídas transitorias de red, validando los contratos de respuesta con Zod y actualizando la interfaz a "Al día ✓". Con esto quedan demostrados en hardware real los atributos de interoperabilidad, portabilidad y funcionamiento sin conexión del sistema.
