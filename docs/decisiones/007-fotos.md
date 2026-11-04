# 007. Subida multipart, disco local detrás de un puerto y compresión en el cliente

Responsable: A. Estado: tomada.

## Problema encontrado

Unos 150 operarios toman tres fotos por actividad desde teléfonos de gama baja, con enlaces que pueden ser malos o intermitentes. Hay que decidir cómo viajan las fotos, dónde se guardan y cuánto pesan, sin romper el despliegue local ni los límites de almacenamiento del celular.

## Opciones evaluadas

Para el transporte, la imagen en base64 dentro de un JSON o un multipart hacia el backend. Para el almacenamiento, un servicio de objetos en la nube con URL prefirmada, columnas `bytea` en PostgreSQL o archivos en el disco del servidor.

Base64 aumenta el peso en un tercio y obliga a cargar la imagen entera en memoria. Un servicio en la nube exige una cuenta y conexión del servidor, y contradice el despliegue local. Guardar las imágenes en PostgreSQL infla la base y sus respaldos. El disco local es lo más simple que funciona.

## Opción seleccionada y por qué

Multipart hacia el backend, con el archivo guardado en disco local (variable `FOTOS_DIR`) detrás de un puerto `AlmacenamientoEvidencias`, y solo los metadatos (ruta, tamaño, tipo) en PostgreSQL. El cliente comprime antes de encolar, a unos 400 KB y un lado mayor de 1600 px, en JPEG o WebP; el servidor rechaza todo archivo de más de 1.5 MB. Los valores exactos están en `LIMITES_EVIDENCIA`, para que ambos lados usen los mismos. Pasar por un puerto significa que pasar a almacenamiento en la nube más adelante es cambiar un adaptador y no tocar el dominio, y es el caso real de segundo adaptador que justifica ese puerto.

## Consecuencias

El respaldo del directorio de fotos debe coordinarse con el de la base de datos. Con los supuestos del ítem 1 del documento, el volumen ronda 1 GB por día de trabajo, así que el disco del servidor es un recurso a vigilar. Las fotos no se cifran a nivel de aplicación (nota 006).
