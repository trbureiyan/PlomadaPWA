const LARGO_MINIMO = 32;

// Solo en NODE_ENV=test se tolera la ausencia de la variable, para que las
// pruebas corran sin .env. En cualquier otro entorno un secreto ausente o corto
// detiene el arranque: un valor por defecto en el código permite forjar tokens.
const SECRETO_DE_PRUEBA = "secreto-solo-para-pruebas-no-usar-en-produccion";

export function leerSecretoJwt(
  env: Record<string, string | undefined>,
): string {
  const secreto = env.JWT_ACCESS_SECRET;
  if (env.NODE_ENV === "test") return secreto ?? SECRETO_DE_PRUEBA;
  if (!secreto || secreto.length < LARGO_MINIMO) {
    throw new Error(
      `JWT_ACCESS_SECRET falta o tiene menos de ${LARGO_MINIMO} caracteres. Defínelo en backend/.env (ver .env.example).`,
    );
  }
  return secreto;
}
