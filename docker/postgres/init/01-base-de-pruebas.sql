-- Las pruebas de adaptadores corren contra una base propia para no tocar
-- los datos de desarrollo. Este script solo corre al crear el volumen;
-- si ya existe, `docker compose down -v` y volver a levantar.
CREATE DATABASE plomada_test OWNER plomada;
