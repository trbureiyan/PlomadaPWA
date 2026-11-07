// Las pruebas nunca tocan la base de desarrollo: truncan y siembran sin preguntar.
export const URL_PRUEBAS_POR_DEFECTO = "postgres://plomada:plomada@localhost:5432/plomada_test";

export function urlPruebas(env: Record<string, string | undefined> = process.env): string {
  return env.DATABASE_URL_TEST ?? URL_PRUEBAS_POR_DEFECTO;
}
