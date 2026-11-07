// setupFiles de Vitest: corre antes de cada archivo de prueba.
import { urlPruebas } from "../infrastructure/database/url-pruebas";

try {
  process.loadEnvFile();
} catch {
  // sin .env se usan los valores por defecto
}
// Aunque el .env apunte a la base de desarrollo, las pruebas usan plomada_test.
process.env.DATABASE_URL = urlPruebas();
