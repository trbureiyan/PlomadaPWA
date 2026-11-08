# 002. PWA que funciona primero sin conexión

Responsable: A. Estado: tomada.

## Problema encontrado

Los operarios no tienen datos móviles y el conjunto cerrado no garantiza ni prohíbe internet. Aun así deben registrar horas y tomar tres fotos por actividad, y esa evidencia tiene que llegar completa y sin duplicados. Usan sus propios celulares, de gama baja o media, sin que la empresa pueda instalarles nada ni gestionarlos.

## Opciones evaluadas

Una aplicación nativa para Android e iOS, una aplicación híbrida (Capacitor o React Native), una web que exige conexión y una PWA diseñada para trabajar sin conexión.

Una web que exige conexión incumple la restricción principal del problema. Una aplicación nativa o híbrida resuelve el trabajo sin conexión, pero obliga a publicar en tiendas, mantener dos plataformas y pedir a 150 personas que instalen y actualicen una aplicación en dispositivos que nadie controla. La PWA se instala desde el navegador, es una sola base de código y alcanza para lo que el problema necesita: guardar datos en IndexedDB, cachear la aplicación con un service worker y sincronizar con una cola.

## Opción seleccionada y por qué

PWA que funciona primero sin conexión. Toda acción del operario se completa contra el almacenamiento local y responde de inmediato, con o sin red; la sincronización es un proceso aparte que drena una cola cuando hay conexión. Es la única opción que cumple la restricción sin cargar a la empresa con distribución y mantenimiento de aplicaciones.

## Consecuencias

El service worker y `crypto.randomUUID()` solo existen en un contexto seguro, es decir, HTTPS o `localhost`. Para el demo se usa el navegador del portátil con la emulación de móvil y el modo sin conexión de las herramientas de desarrollo; probar en un celular real se hace con `adb reverse` hacia `localhost`, que es un contexto seguro (`docs/pruebas-celular.md`; corregido el 7 de noviembre de 2026, cuando la nota decía HTTPS local con certificado o túnel). La Background Sync API no es utilizable porque iOS no la soporta, así que la sincronización se dispara al abrir la aplicación, al volver la conexión y con un botón manual. Las cuotas de almacenamiento de los teléfonos de gama baja obligan a comprimir las fotos antes de encolarlas (nota 007).
