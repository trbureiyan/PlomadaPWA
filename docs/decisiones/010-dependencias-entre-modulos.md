# 010. Grafo de dependencias entre módulos sin ciclos

Responsable: A. Estado: tomada.

## Problema encontrado

Las reglas del sistema obligan a los módulos a conocerse. `evidencias` y `jornada` necesitan saber si una actividad existe y a quién está asignada, y eso pertenece a `programacion`. Pero `programacion` también debe devolver el estado de cada actividad, y ese estado se deriva de hechos que registran `evidencias` y `jornada`. Si cada módulo importa al otro, aparece un ciclo, y un ciclo entre módulos es el acoplamiento que el estilo modular existe para evitar. Si B y C descubren esto a mitad del desarrollo, alguien tendrá que rehacer trabajo.

## Opciones evaluadas

Dejar que los módulos se importen libremente. Mover la derivación del estado a un módulo aparte que lea de todos. Hacer que `programacion` declare un puerto para lo que necesita y que la raíz de composición lo implemente. Comunicar los módulos mediante eventos de dominio.

Importarse libremente produce el ciclo. Un módulo aparte para derivar estados traslada a `seguimiento`, que es P2, rutas que son P0. Los eventos de dominio resuelven el ciclo pero agregan un mecanismo (bus, orden de entrega, manejo de fallos) desproporcionado para un monolito de seis módulos.

## Opción seleccionada y por qué

Un grafo de dependencias sin ciclos en el que cada flecha significa "importa la interfaz pública de". `personal` y `programacion` dependen de `identidad`. `jornada` y `evidencias` dependen de `programacion`. `seguimiento`, que solo lee, depende de `programacion`, `jornada` y `evidencias`. Nadie depende de `seguimiento`.

Cuando un módulo necesita algo de otro que ya depende de él, declara un puerto con lo que necesita y la raíz de composición, que es el único archivo autorizado a conocer todos los módulos, lo implementa llamando a la interfaz pública del otro. Así `programacion` declara el puerto `HechosDeActividad` para armar el estado de las actividades que devuelve, y la raíz de composición lo implementa con lo que expongan `evidencias` y `jornada`. La regla que deriva el estado es una función pura del dominio de `programacion`, expuesta en su interfaz pública, y `evidencias` la usa para las rutas `/actividades`. Es inversión de dependencias aplicada a un caso real, sin mecanismos nuevos.

## Consecuencias

La raíz de composición hace de pegamento entre módulos y crecerá un poco; debe seguir siendo cableado, sin reglas de negocio. Si B encuentra otro ciclo, aplica la misma salida y lo anota aquí en un PR; no lo resuelve con un import cruzado.

Al 7 de noviembre de 2026 el código no necesitó dos de las aristas previstas. `personal` y `programacion` no importan `identidad`, porque los datos de usuarios llegan por la raíz de composición. `seguimiento` no importa `evidencias`, porque lee los hechos de las actividades por `HechosDeActividadPort`, que la raíz implementa; solo importa `jornada` y `programacion`.
