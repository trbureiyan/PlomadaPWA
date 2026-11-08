# 016. El día de negocio se cuenta en hora de Bogotá

Responsable: A. Decisor: Brayan. Estado: tomada, hallazgo 5 de la revisión profunda.

## Problema encontrado

El backend calculaba «hoy», la semana en curso y el día al que pertenece un evento de jornada con la fecha UTC. El despliegue y los usuarios están en Colombia (UTC-5, sin horario de verano), así que a partir de las 19:00 locales la fecha UTC ya es la del día siguiente. Cuatro sitios lo hacían: `obtener-seguimiento-dia.use-case.ts`, `obtener-mi-programacion.use-case.ts`, `pg-registro-jornada.repository.ts` y su versión en memoria. Por la noche el seguimiento sin `fecha` mostraba un día vacío, una salida registrada a las 19:30 aparecía en el día siguiente y, desde el domingo a las 19:00, `/mi-programacion` pasaba a la semana próxima antes de tiempo.

La nota 005 fija que los instantes se guardan en UTC, y eso no cambia. Lo que faltaba era decidir a qué día de calendario pertenece un instante.

## Opciones evaluadas

1. Dejar UTC y documentarlo. Descartada: el supervisor ve el día equivocado cada tarde.
2. Zona configurable por variable de entorno. Descartada: nadie la ha pedido y es configuración sin un segundo caso real (YAGNI).
3. Una zona fija de negocio, `America/Bogota`, con un único helper.

## Opción seleccionada y por qué

Opción 3. `backend/src/compartido/tiempo.ts` define `ZONA_NEGOCIO` y las funciones `hoyEnNegocio`, `lunesDeLaSemanaActual` y `diaDeNegocio`; los cuatro sitios y el seed las usan, de modo que la regla vive en un solo lugar. En PostgreSQL el filtro por día usa `AT TIME ZONE` con la misma constante. Los instantes siguen en UTC. El mismo archivo trae `esMismoInstante`, que compara dos instantes como instantes y no como texto (hallazgo 7): el contrato acepta `...:00Z` y PostgreSQL devuelve `...:00.000Z`.

## Consecuencias

La carpeta `compartido/` está dentro de `backend/src`, fuera de los módulos, y no importa nada salvo `@plomada/shared`; así los casos de uso la usan sin depender de infraestructura. Si el sistema se despliega en otro país, hay que cambiar la constante y revisar esta nota. El cliente tiene su propio helper, `frontend/src/utils/tiempo.ts`, con la misma zona, y desde el 7 de noviembre de 2026 lo usa para decidir qué día muestra la pantalla del operario. Las demás pantallas del cliente todavía calculan "hoy" con la fecha UTC (Anexo C del documento de arquitectura).
