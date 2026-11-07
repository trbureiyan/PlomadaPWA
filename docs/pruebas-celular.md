# Prueba en un celular real (C-7)

Fecha: 7 de noviembre de 2026. Ejecutó Pablo (Rol C). Referencia: tarea C-7 de `docs/plan-de-correcciones.md`.

Este documento recoge solo lo que las capturas de pantalla y la conversación de la prueba demuestran. Lo que no se probó está en la sección 4, con su causa. Una primera versión de este informe, escrita por Pablo, describía pasos que el contexto de la prueba no permite (instalación, service worker, almacenamiento persistente, arranque en frío sin red) y citaba nombres que no existen en el código; se reemplazó por esta.

## 1. Cómo se probó

La aplicación se sirvió con el build de producción en el computador y se abrió desde el celular en `http://192.168.1.45:4173`, por la red Wi-Fi local. El backend corría en el mismo computador. El plan pedía HTTPS o `localhost`; no se usó ninguno de los dos, porque HTTPS no funcionó en el celular y no se probó `adb reverse`. Esto condiciona lo que se pudo verificar (sección 4).

Dispositivo: celular Android con Chrome. El modelo exacto y la versión del navegador no constan en las capturas y los confirma Pablo. Usuario de la prueba: operario de la semilla, programación de la semana del 2 al 6 de noviembre.

## 2. Hallazgo: `crypto.randomUUID` no existe en HTTP sobre IP

Al registrar la entrada al centro, la aplicación mostró el error `crypto.randomUUID is not a function`. `crypto.randomUUID()` solo está disponible en contextos seguros (HTTPS o `localhost`), y `http://192.168.1.45` no lo es. La QA de escritorio no podía verlo porque probó sobre `localhost`.

Corrección (PR #21): `generarUUIDSeguro` en `frontend/src/utils/uuid.ts` usa `crypto.randomUUID()` cuando existe y, si no, construye un UUID v4 con `crypto.getRandomValues`, que sí está disponible en contextos no seguros. El motor de sincronización la usa para el id de cada registro de jornada, de cada evidencia y de cada elemento de la cola. El id es la clave de idempotencia del servidor, así que siguen siendo identificadores únicos y válidos. Cubierta por `frontend/src/utils/uuid.test.ts`, incluido el caso sin `randomUUID`.

## 3. Lo que se observó

Con el arreglo aplicado, las capturas muestran:

- La aplicación carga y responde en el celular. La barra superior muestra "EN LÍNEA" y "Al día" con la cola vacía.
- Con red, una entrada al centro registrada a las 12:08 queda en estado "SUBIDO".
- Con el modo avión activado (las capturas de las 12:13 están rotuladas así), se registraron una segunda entrada (12:10) y una salida (12:11). Ambas quedan "EN COLA" y la aplicación no falla ni se bloquea.
- Sin red, en la segunda actividad se tomaron tres fotos de evidencia, que quedaron en cola con pesos de 207 kB (antes), 167 kB (durante) y 146 kB (después), por debajo de la meta de unos cientos de kilobytes. El panel muestra "3 foto(s)" y cada una con "EN COLA".
- Al volver la red, los tres registros de jornada (las dos entradas y la salida) pasan a "SUBIDO".

Esto demuestra, en un celular real y con la pestaña ya abierta, el registro sin conexión, la cola visible y la subida de las jornadas al recuperar la red.

## 4. Lo que no se probó

Ninguno de estos puntos se puede verificar por `http://IP`, porque el navegador no registra el service worker ni concede almacenamiento persistente fuera de un contexto seguro:

- Instalar la PWA y la validez del manifiesto y de los íconos en el dispositivo (EC-10).
- Que la aplicación abra en frío, sin red, desde el precaché del service worker. La prueba funcionó sin red solo porque la pestaña ya estaba cargada; cerrada y reabierta sin conexión habría fallado.
- Que `navigator.storage.persisted()` devuelva `true` (C-8).
- Que las tres fotos hayan llegado al servidor al volver la red. Las capturas muestran las jornadas subidas, no el estado final de las fotos.
- El orden de envío observado en el servidor (jornadas antes que fotos, C-2) y el reintento con retroceso ante un servidor caído (C-1) en el dispositivo. Ambos están cubiertos por pruebas automatizadas y por la QA de escritorio, no por esta prueba.
- Tiempos de compresión, uso de memoria y modelo exacto del dispositivo.

## 5. Para completar la prueba

Repetir en el mismo celular, con la PWA servida en un contexto seguro. Es una repetición de unos diez minutos con cable USB y depuración activada:

```bash
adb reverse tcp:4173 tcp:4173
adb reverse tcp:3000 tcp:3000
```

Después abrir `http://localhost:4173` en Chrome del celular. `localhost` cuenta como contexto seguro y no necesita certificados. En esa pasada se comprueba, en orden: la primera carga con red, la instalación, `navigator.storage.persisted()`, el cierre completo de la aplicación, su apertura en modo avión, el registro de entrada, tres fotos y salida, y la llegada de todo al servidor al volver la red, con las tres fotos y las jornadas sin duplicados. El resultado se agrega a este documento como una sección nueva, sin borrar la anterior.

Mientras no se haga, C-7 queda como pendiente conocido en el documento de arquitectura, con esta causa.

## 6. Consecuencia para la demostración

Para mostrar la PWA funcionando sin red en un celular, hay que servirla en un contexto seguro: `adb reverse` con `localhost`, o HTTPS. Abrirla por la IP del computador en HTTP deja la aplicación sin service worker y sin almacenamiento persistente, y no es lo que se quiere mostrar. Esto no es un defecto de la aplicación sino una restricción del navegador, y el HTTPS de producción sigue fuera de v1 (sección 8 del plan). Queda anotado en `docs/demostracion.md`.
