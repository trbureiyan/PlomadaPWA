import pg from "pg";

let poolInstance: pg.Pool | null = null;

export function obtenerPool(connectionString?: string): pg.Pool {
  if (!poolInstance) {
    const connStr = connectionString ?? process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error("DATABASE_URL no está configurada.");
    }
    poolInstance = new pg.Pool({ connectionString: connStr });
  }
  return poolInstance;
}

export async function cerrarPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
