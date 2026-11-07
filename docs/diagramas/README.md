# Diagramas

Todos los diagramas del documento de arquitectura se escriben en [D2](https://d2lang.com), un lenguaje de texto para diagramas. Son archivos `.d2` en esta carpeta; cada uno se convierte en un `.svg` con el mismo nombre, y ese SVG es el que se ve en GitHub y en el PDF. Se versionan los dos.

## Cómo se trabaja

```bash
pnpm --filter @plomada/docs diagramas                 # convierte todos
pnpm --filter @plomada/docs diagramas componentes     # solo componentes.d2
```

No hace falta instalar D2: el paquete `@plomada/docs` trae el compilador. Para ver el resultado, abre el `.svg` en el navegador o mira la vista previa de `docs/arquitectura.md` en el editor. Para insertarlo en el documento, una imagen de Markdown con un texto que sirve de pie de figura:

```markdown
![Diagrama de componentes del backend](diagramas/componentes.svg)
```

El PDF completo se genera con `pnpm --filter @plomada/docs pdf`. Usa el Chrome o el Edge que ya tengas instalado, y lo deja en `docs/pdf/salida/`.

## Reglas de estilo

Todo diagrama empieza con `...@estilo` en la primera línea, que importa `estilo.d2`. Ahí están las clases, y los elementos se marcan con ellas en vez de con colores sueltos; así todos los diagramas parecen del mismo documento. Si falta una clase, se agrega en `estilo.d2` con un PR a A, no se improvisa un color.

| Clase        | Para qué                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| `actor`      | Personas y sistemas externos que actúan, en casos de uso y secuencias    |
| `sistema`    | El límite del sistema o un contenedor importante, como el backend        |
| `caso`       | Un caso de uso                                                           |
| `nucleo`     | La pieza central del diagrama, como un módulo protagonista o la API      |
| `componente` | Un componente, módulo o capa común                                       |
| `externo`    | Algo fuera de nuestro control: SMTP, adaptadores, la raíz de composición |
| `datos`      | Bases de datos y almacenamiento                                          |
| `nodo`       | Un nodo físico en el diagrama de despliegue                              |
| `nota`       | Una nota aclaratoria                                                     |
| `usa`        | Conexión normal: usa, invoca, depende de                                 |
| `implementa` | Un adaptador que implementa un puerto (línea punteada, triángulo vacío)  |
| `generaliza` | Herencia entre actores o clases (línea continua, triángulo vacío)        |
| `participa`  | Asociación de un actor con un caso de uso, sin flecha                    |

Los textos van en español y en oraciones cortas; los nombres de módulos, puertos y tablas se escriben exactamente como en el código. La dirección se elige para que el diagrama quepa en una página carta: `direction: right` para diagramas anchos y bajos, `direction: down` para los altos y angostos. Si un diagrama queda ilegible a ese tamaño, se divide en dos, como los casos de uso.

## Ejemplos para los diagramas pendientes

Componentes (B), en `componentes.d2`:

```d2
...@estilo
direction: right

backend: Backend {
  class: sistema
  programacion: programacion {class: nucleo}
  repo: "ProgramacionRepository\npuerto" {class: componente}
  programacion -> repo {class: usa}
}
pg: "PgProgramacionRepository" {class: externo}
pg -> backend.repo: implementa {class: implementa}
```

Entidad relación (B), en `entidad-relacion.d2`, con una tabla por entidad y la notación de pata de gallo:

```d2
...@estilo
direction: right

usuarios: {
  shape: sql_table
  id: uuid {constraint: primary_key}
  correo: text {constraint: unique}
  rol: text
}
asignaciones: {
  shape: sql_table
  id: uuid {constraint: primary_key}
  operario_id: uuid {constraint: foreign_key}
  fecha: date
}
asignaciones.operario_id -> usuarios.id {
  source-arrowhead: {shape: cf-many}
  target-arrowhead: {shape: cf-one-required}
}
```

Despliegue (C), en `despliegue.d2`, con nodos que contienen lo que corre en ellos:

```d2
...@estilo
direction: right

celular: "Celular del operario" {
  class: nodo
  navegador: "Navegador\nPWA" {class: componente}
}
portatil: "Portátil del equipo" {
  class: nodo
  api: "Proceso Node.js\nAPI" {class: nucleo}
}
celular.navegador -> portatil.api: "HTTPS · /api/v1" {class: usa}
```
