// globalSetup de Vitest: deja plomada_test migrada antes de correr cualquier archivo.
import { ejecutarMigraciones } from "../infrastructure/database/migrator";
import { urlPruebas } from "../infrastructure/database/url-pruebas";

export default async function preparar(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // sin .env se usan los valores por defecto
  }
  await ejecutarMigraciones({ databaseUrl: urlPruebas() });
}
