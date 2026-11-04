# 006. Token de acceso corto y refresh rotativo

Responsable: A. Estado: tomada.

## Problema encontrado

El enunciado pide definir protocolos de autenticación y cifrado. La dificultad es que un operario puede pasar horas sin conexión y sincronizar después, con una sesión que en ese momento ya debería haber vencido, sin que por eso haya que dejar un token de larga vida expuesto en un celular personal.

## Opciones evaluadas

Un JWT de vida larga, una sesión con cookie validada por el servidor, un JWT de acceso corto con refresh token opaco rotativo, y un proveedor externo de identidad (inicio de sesión único con el correo institucional).

Un JWT de varios días no se puede revocar y, si se roba el celular, da acceso durante todo ese tiempo. La cookie de sesión exige que el servidor valide en cada petición y encaja mal con una cola que sincroniza horas después. Un proveedor externo depende de qué plataforma de correo use la empresa, un dato que el enunciado no da, y excede el alcance del taller.

## Opción seleccionada y por qué

Token de acceso JWT de 15 minutos y refresh token opaco de 7 días que rota en cada uso y se guarda con hash en la base de datos. Las contraseñas se almacenan con argon2id. El rol viaja en el token y la autorización se decide en la capa de aplicación, no en el router. En producción todo viaja por TLS. Antes de sincronizar, el cliente renueva la sesión con el refresh token; si eso falla con 401, el operario vuelve a iniciar sesión y la cola se conserva. Así el daño de un token robado queda acotado y la sesión se puede revocar, y aun así la cola funciona después de horas sin red.

## Consecuencias

B implementa una tabla de refresh tokens y la rotación, lo que agrega trabajo al módulo `identidad`. Si ese costo resulta alto, B propone una simplificación mediante un PR a esta nota y al contrato, por ejemplo un refresh sin rotación, y nunca la aplica en silencio. Las fotos no se cifran a nivel de aplicación; se confía en el cifrado de disco del sistema operativo, y esa limitación queda en el documento.
