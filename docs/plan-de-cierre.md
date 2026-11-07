# Plan de cierre

Fecha: 7 de noviembre de 2026. Responsable: Brayan (Rol A).

Este documento ordena lo que falta entre hoy y la entrega. Complementa a `docs/plan-de-trabajo.md` (qué entrega cada rol y con qué criterio) y a `docs/plan-de-correcciones.md` (defectos de la prueba de ejecución). Recoge decisiones tomadas después de ambos.

## 1. Dónde estamos

La rama `integracion` (df4b5bf al empezar este plan) tiene fusionadas las correcciones B-1 a B-8 de Juan Camilo y C-1 a C-6, C-8 y C-9 de Pablo. Typecheck sin errores; 111 pruebas de backend, 46 de frontend y 20 de `shared` en verde. `main` no tiene ningún cambio de esta fase.

Nomenclatura, para no confundir dos cosas con nombre parecido:
- **C7** es la tarea del plan de trabajo: el diagrama de despliegue y su inventario, ítem 9 del documento.
- **C-7** es la tarea del plan de correcciones: la prueba en un celular real.

## 2. Qué falta y quién lo cubre

| Pendiente | Dueño | Cómo se cubre |
|---|---|---|
| Ítem 6, diagrama de componentes (B6) | Juan Camilo | Revisarlo contra el código tras B-3 y regenerarlo en D2 |
| Ítem 7, diagrama entidad-relación (B1) | Juan Camilo | Verificar que existe en D2; si no, hacerlo. Seis migraciones y once tablas, nombres del glosario, el estado de la actividad no es columna |
| Límite de B-7 | Juan Camilo | Un párrafo: qué valida la firma de la foto y qué no, para la lista de defectos conocidos |
| Ítem 9, diagrama de despliegue (C7) | Pablo, con apoyo del Rol A | Ver sección 5 |
| Prueba en celular real (C-7) | Cualquiera del grupo | Ver sección 5 |
| Ítems 6 a 9 contra el código final, cierre del TODO del ítem 7 | Brayan | Revisión final antes del PDF |
| Tabla de principios SOLID y Clean Code con archivo y línea reales | Brayan | Solo incluye lo verificado abriendo el archivo |
| Sección de verificación con las cifras medidas | Brayan | Con las limitaciones declaradas y los defectos no corregidos |
| SVG, PDF y estado "Borrador" a final | Brayan | Al final, después de cualquier cambio de código |

## 3. Orden de la fase final

1. **Verificación en limpio y formato.** Sobre `integracion`: instalación con `--frozen-lockfile`, typecheck y pruebas de todos los paquetes contra PostgreSQL en el 5432, siguiendo la sección "Entorno sin Docker" del README. Después, un solo commit de Prettier sobre todo el repositorio. El formato va antes de la revisión para que los hallazgos reales no se mezclen con ruido de estilo.
2. **PR en borrador de `integracion` a `main`.** Se abre ya, aunque falte documentación, porque la CI solo se dispara con PR hacia `main` y esta será su primera ejecución completa. Un borrador no mezcla nada y cada push posterior la vuelve a correr.
3. **Revisión profunda del PR.** Sobre el borrador, con foco en la autorización de recursos, el motor de sincronización, la derivación del estado y el manejo de errores del servidor. Los hallazgos se corrigen por PR hacia `integracion`, cada uno por quien conoce esa zona.
4. **Documento.** Con el código ya estable: ítems 6 a 9 revisados contra el código final, TODO del ítem 7 cerrado, tabla de principios, sección de verificación, SVG regenerados y PDF. El cambio de "Borrador" a final es lo último, porque cualquier cambio de código puede mover lo que dicen los ítems.
5. **Ensayo y sustentación.** Ver sección 4.
6. **Merge a `main`.** Solo con la CI en verde, el PDF final, el resultado de C-7 registrado (o, si no se hizo, la limitación anotada en el documento) y los once ítems del enunciado presentes. Lo hace Brayan. Las ramas ya fusionadas se borran después, no antes.

Mientras tanto siguen las reglas de siempre: no se agregan funcionalidades, no se hacen commits directos a `integracion`, no se reescribe historia y toda corrección entra por PR.

## 4. Ensayo y sustentación sin reunión

No es posible reunir a los tres, así que se hace de forma asíncrona y apoyada en Claude Code.

**Ensayo técnico de la demostración.** Claude Code levanta el sistema desde cero en un entorno limpio con la sección "Entorno sin Docker", y recorre los seis pasos de `docs/demostracion.md` con un navegador automatizado en emulación de móvil, incluido el corte de red y la reconexión. Con eso se confirma que la demostración funciona y que las instrucciones son reproducibles en una máquina que no es la de quien las escribió. No sustituye a la prueba en celular real.

**Simulacro de sustentación.** El enunciado exige sustentar los principios de arquitectura aplicados, sobre todo cuando se usó IA. Cada integrante tiene un simulacro en el que Claude Code hace el papel del profesor: pregunta sobre el código real, con archivo y línea, y señala dónde la respuesta se queda corta. Cada uno responde sobre su parte y sobre el panorama general. Se repite hasta responder sin dudar. Las preguntas y las respuestas del simulacro son material de estudio personal y no forman parte de la entrega.

**Guion de la presentación.** Quién habla y cuánto dura cada parte. Cada uno lo practica por su cuenta y manda un audio corto con su fragmento, para detectar excesos de tiempo y huecos.

## 5. Si alguien no está disponible

Pablo está ocupado con otras obligaciones estos días. Lo mínimo que se le pide es confirmar por mensaje el diagrama de despliegue y estar localizable para la demostración y la sustentación. Lo demás se cubre así:

- **Diagrama de despliegue (C7).** Lo redacta el Rol A con ayuda de Claude Code a partir del código real: `docker-compose.yml`, puertos, servicios (navegador con la PWA, servidor Express, PostgreSQL, Mailpit, disco de fotos). El enunciado permite despliegue local y no hay recursos para otro, así que no se despliega en ningún servidor: el diagrama es el del entorno local de demostración. El ítem 9 sigue siendo obligatorio como diagrama aunque no haya despliegue real. Pablo lo confirma o lo corrige en un mensaje.
- **Prueba en celular real (C-7).** Es opcional según el plan de trabajo, porque la demostración corre en el portátil con emulación de móvil y modo sin conexión. Conviene hacerla de todos modos: sin ella, la instalación en un celular real (C1 y EC-10) queda sin demostrar y se documenta como limitación. No requiere conocer el código del cliente: cualquiera del grupo con un celular puede hacerla. Se instala la PWA, se abre en modo avión después de la primera carga, se registra entrada, se toman tres fotos sin red, se registra fin, se vuelve la red y se comprueba que todo llega. El resultado (modelo, navegador, qué funcionó y qué no) queda en `docs/pruebas-celular.md`.
- **Regla general.** Si algo asignado a una persona no está para la fecha de revisión, lo absorbe el Rol A y se registra en una nota de decisión, como ya prevé el plan de trabajo para `identidad`.

## 6. Cuándo está terminado

- Los once ítems del enunciado están en el documento y coinciden con el código.
- Al menos dos módulos funcionan localmente (hoy son seis).
- Los principios aplicados se sustentan con archivos y líneas reales.
- La CI del PR a `main` está en verde.
- El guion de demostración se ejecutó completo, de principio a fin, al menos una vez.
- Cada integrante respondió el simulacro sobre su parte sin quedarse en blanco.
- Los defectos conocidos que no se corrigieron están descritos con exactitud en el documento.
