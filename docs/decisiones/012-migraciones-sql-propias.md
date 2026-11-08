# 012. Migraciones SQL numeradas con un ejecutor propio

Responsable: B. Estado: tomada.

## Problema encontrado

El valor por defecto de `docs/decisiones/README.md` para las migraciones era `node-pg-migrate`. El esquema del demo son seis archivos SQL planos y el ejecutor debe correr igual sobre `plomada` y `plomada_test`, sin que nadie edite la base a mano.

## Opciones evaluadas

`node-pg-migrate`, que añade una dependencia, su propio formato de archivos y su configuración. Un ejecutor propio de un centenar de líneas sobre `pg`, que lee los `.sql` de `backend/db/migrations/` en orden y registra cada uno en la tabla `migraciones`.

## Opción seleccionada y por qué

El ejecutor propio (`backend/src/infrastructure/database/migrator.ts`). Los archivos siguen siendo SQL numerado, como pide AGENTS.md, y cada migración se aplica una sola vez; las pruebas de adaptadores lo reutilizan para preparar `plomada_test`. Evita una dependencia que no aporta nada a este tamaño de esquema (KISS y YAGNI). Si el esquema crece o hacen falta migraciones de reversa, se reemplaza por `node-pg-migrate` sin tocar los archivos SQL.

## Consecuencias

No hay migraciones de reversa: una corrección es una migración nueva. El ejecutor no calcula sumas de verificación, así que editar una migración ya aplicada no se detecta; la regla es no editarlas.
