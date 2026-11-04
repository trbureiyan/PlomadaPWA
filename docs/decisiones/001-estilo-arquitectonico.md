# 001. Monolito modular con arquitectura hexagonal

Responsable: A. Estado: tomada.

## Problema encontrado

Hace falta un estilo arquitectónico que sirva a unos 200 usuarios, con un cliente que trabaja sin conexión, que construyan tres personas en pocas semanas, que se despliegue en local y que permita demostrar y justificar principios de diseño con al menos dos módulos funcionando. La carga es baja; el riesgo real está en la integración entre personas y en que las reglas del negocio queden enredadas con la base de datos, el disco y el correo.

## Opciones evaluadas

Microservicios, arquitectura por capas clásica, MVC, y monolito modular con arquitectura hexagonal dentro de cada módulo.

Los microservicios resuelven problemas de escala y de equipos independientes que este proyecto no tiene, y cobran su precio completo: red entre servicios, despliegues múltiples, consistencia entre bases y observabilidad. Con tres integrantes y una máquina local ese costo no compra nada. La arquitectura por capas clásica separa presentación, negocio y datos, pero la dependencia apunta hacia la base de datos, de modo que probar una regla exige una base, y con el tiempo los módulos se acoplan por las tablas. MVC es un patrón para organizar la capa de presentación, no una arquitectura de sistema, y no dice dónde van las reglas ni los límites con lo externo.

## Opción seleccionada y por qué

Monolito modular, con cada módulo organizado en dominio, casos de uso y adaptadores, y con puertos que invierten la dependencia hacia lo externo. Es un solo despliegue, que es lo que el contexto pide. Cada módulo oculta sus detalles detrás de una interfaz pública, lo que da alta cohesión y bajo acoplamiento y deja la puerta abierta a extraer un módulo si algún día hiciera falta. Los puertos aíslan exactamente lo que cambia o estorba en las pruebas (PostgreSQL, el disco de las fotos, el servidor SMTP), de modo que el dominio y los casos de uso se prueban rápido con repositorios en memoria. La separación en módulos también sirve para el reparto del trabajo: B y C pueden avanzar sin pisarse.

## Consecuencias

Cada módulo tiene más archivos que en un diseño plano. Para que esa ceremonia no se vuelva un fin en sí misma, la regla de AGENTS.md es no crear un puerto donde no haya un segundo adaptador ni una razón real para cambiar; los puertos existen solo en los límites con la base de datos, el almacenamiento de fotos, el correo y HTTP.
