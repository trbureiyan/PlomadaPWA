# 003. PERN con TypeScript, workspace de pnpm y paquete shared

Responsable: A. Estado: tomada.

## Problema encontrado

El stack es PERN por decisión del grupo, y falta definir cómo se organiza el código para que tres personas trabajen en paralelo sin que el backend y el frontend se desalineen en silencio, y sin que dos integrantes con poca práctica en Git tengan que pelear con herramientas.

## Opciones evaluadas

JavaScript o TypeScript. Repositorios separados o un monorepo. npm, yarn o pnpm. Declarar los tipos de la API en cada lado o compartirlos.

JavaScript tiene menos fricción inicial, pero deja los puertos hexagonales como una convención que existe solo en la cabeza y en el documento, y deja el contrato entre B y C a merced de la disciplina. Repositorios separados obligan a publicar el contrato como paquete y a coordinar versiones, lo cual es mucho para un taller. Entre los gestores de paquetes, pnpm ofrece workspaces y un catálogo de versiones únicas, y su archivo `packageManager` fija la misma versión para todo el equipo.

## Opción seleccionada y por qué

TypeScript en modo estricto en todo el código, en un monorepo de pnpm con tres paquetes (`shared`, `backend` y `frontend`) y las versiones de las dependencias comunes centralizadas en el catálogo de `pnpm-workspace.yaml`. El paquete `shared` contiene los esquemas del contrato, de modo que un cambio en un campo hace fallar la compilación del otro paquete en lugar de fallar en la integración. Los puertos son interfaces verificables por el compilador, y el repositorio en memoria y el de PostgreSQL deben implementar la misma. Con IA en el equipo, el compilador además actúa como red de seguridad contra código plausible pero incorrecto. PostgreSQL es la base elegida por la fuerte relación entre operario, asignación, actividad y evidencia; B desarrolla la justificación en el ítem 8 del documento.

## Consecuencias

El esqueleto, que ya está montado, absorbe la configuración inicial, y el equipo paga la curva de TypeScript. Las versiones actuales (TypeScript 7, Vite 8, Vitest 5) son mayores recientes: si alguna herramienta que B o C quieran sumar falla con ellas, la salida es anclar una versión anterior en el catálogo mediante un PR de A, no resolverlo con parches locales.
