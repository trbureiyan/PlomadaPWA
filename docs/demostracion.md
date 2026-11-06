# Guion de la demostración y ensayo

Este guion sale del guion de aceptación final de `docs/plan-de-correcciones.md` (sección 7). Es el mismo recorrido, escrito para presentarlo. La demostración solo es presentable cuando ese guion pasa completo sobre la rama `integracion`; los pasos 3 y 4 dependen de las correcciones C-1, C-2, C-3 y C-4 del plan.

## Preparación

Se ejecuta en la máquina de la demostración, sobre la rama que se va a presentar. Ver "Entorno sin Docker" en el README cuando B-5 lo incorpore.

```bash
pnpm install --frozen-lockfile
pnpm --filter @plomada/backend migrate
pnpm --filter @plomada/backend seed
pnpm --filter @plomada/backend dev
pnpm --filter @plomada/frontend build
pnpm --filter @plomada/frontend exec vite preview --port 4173
```

El backend escucha en el puerto 3000 y la PWA en el 4173. Mailpit (SMTP 1025, interfaz 8025) debe estar arriba para mostrar los correos. Usuarios de la semilla: `admin@`, `administrativo@`, `supervisor@` y `operario1@` a `operario3@plomada.local`, todos con la contraseña `Plomada2026!`. La semilla vacía las tablas, así que se corre una sola vez antes de ensayar y nunca contra datos que importen.

Antes de empezar: el celular o la ventana del operario ya cargaron la PWA una vez con red, para que el service worker tenga la aplicación en el precaché.

## Recorrido

### 1. El administrador programa y publica (3 min)

Con la sesión del administrativo o del administrador, crear una programación para la semana en curso con una asignación por operario, un centro de trabajo y al menos una actividad cada una, y publicarla. Abrir Mailpit y mostrar un correo por operario con su semana. Decir en voz alta que el estado de las actividades no se guarda: se deriva (nota 005).

Qué debe verse: la programación en estado `publicada` y un correo por operario, sin mezclar actividades de otros.

### 2. El operario trabaja sin conexión (4 min)

Con la sesión de un operario, activar el modo avión y registrar la entrada al centro, iniciar la actividad, tomar tres fotos (antes, durante, después) y registrar el fin. La barra superior debe mostrar los elementos pendientes y nada debe fallar ni bloquearse.

Qué debe verse: la app sigue funcionando sin red y la cola crece con cada acción.

### 3. La red falla de otra forma (3 min)

Con la cola llena, volver a dar red pero con el servidor detenido durante varios minutos, de modo que cada intento falle. Esperar al menos un minuto. Mostrar que la cola conserva todo y que la barra no dice "Al día".

Qué debe verse: nada se descarta y los reintentos espaciados siguen ocurriendo (C-1, C-3).

### 4. Vuelve la conexión (3 min)

Levantar el servidor. La cola se drena sola. Mostrar en el servidor las tres fotos exactas y las jornadas, en ese orden: jornada primero, fotos después, sin duplicados. Si se quiere reforzar la idempotencia, repetir un envío a propósito con el mismo UUID y mostrar que no se duplica (nota 005).

Qué debe verse: exactamente 3 fotos y las jornadas, sin repeticiones, y la barra en "Al día" solo cuando ya no hay pendientes ni fallidos.

### 5. El supervisor revisa (3 min)

Con la sesión del supervisor, abrir la actividad y comprobar que su estado coincide con el que vio el operario. Aprobarla, y luego mostrar que un rechazo sin observación no se acepta. Mostrar el seguimiento del día con la entrada y la salida del operario.

Qué debe verse: el mismo estado en las dos vistas, una revisión registrada y la observación obligatoria en el rechazo (B-3).

### 6. Cierre con las pruebas (1 min)

Mostrar `pnpm -r typecheck` y `pnpm -r test` en verde y la CI de la rama en verde. Terminar con los límites conocidos de la sección 8 del plan: la edición de una programación publicada, TLS, la carga sostenida de 30 minutos y la compresión adaptativa de fotos están fuera de v1 y documentados, no ocultos.

## Lo que se dice al empezar

El panel de administración existe como excepción aprobada a la nota 008 (nota 013). La autorización por rol vive en el router, desvío aceptado y registrado en la nota 014. Decirlo desde el principio evita que lo descubra el jurado.

## Lista de comprobación del ensayo (I4)

Se hace un ensayo completo al menos un día antes, con el mismo equipo y la misma red de la sustentación.

Máquina y servicios:

- La rama presentada es `integracion` (o la que Brayan indique) y `git status` está limpio.
- PostgreSQL, el backend, la PWA y Mailpit arrancan desde cero siguiendo la sección de preparación, sin variables exportadas a mano.
- `JWT_ACCESS_SECRET` está definido en el `.env` con 32 caracteres o más.
- La semilla se ejecutó una vez y no se vuelve a correr durante la presentación.

Datos y cuentas:

- Se puede iniciar sesión con los cuatro roles.
- Hay una programación publicada y una sin publicar para mostrar el contraste, o los datos para crearla en vivo.
- Mailpit está vacío antes de empezar.

Cliente:

- La PWA cargó una vez con red y el service worker está activo.
- El modo avión del dispositivo funciona y se sabe dónde activarlo.
- Los íconos de la aplicación cargan (C-5) y el dispositivo permite instalarla, si se va a mostrar la instalación.
- La cámara o el selector de fotos funciona, y hay tres fotos de prueba a mano por si la captura falla.

El recorrido:

- Los seis pasos se ejecutaron completos y se cronometraron; el total cabe en el tiempo asignado con margen.
- Cada integrante sabe qué paso narra y quién maneja cada pantalla.
- Se ensayó el fallo del paso 3: detener el servidor, esperar, levantarlo.
- Se ensayó qué decir si algo falla en vivo: se nombra el límite conocido que corresponde, se muestra la prueba automatizada que lo cubre y se sigue con el paso siguiente.

Preguntas probables, con respuesta preparada:

- Por qué un monolito modular y no microservicios (nota 001).
- Por qué la jornada y la evidencia son idempotentes y qué pasa si un envío se corta (nota 005).
- Por qué el estado de la actividad se deriva en vez de guardarse (nota 005 y `docs/contrato-api.md`).
- Dónde está la autorización y por qué en el router (nota 014).
- Por qué Dexie y no `localStorage` ni `idb` (nota 011).
- Qué cumple hoy la regla de que ningún módulo consulta tablas de otro y qué excepción queda abierta (ítem 7 del documento, tarea B-3).

Respaldo:

- Hay un video corto del recorrido completo por si falla la red del lugar.
- Hay una copia del PDF del documento y de este guion fuera del computador de la demostración.
