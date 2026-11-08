import pg from "pg";

let poolInstance: pg.Pool | null = null;

export function obtenerPool(connectionString?: string): pg.Pool {
  if (!poolInstance) {
    const connStr = connectionString ?? process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error("DATABASE_URL no está configurada.");
    }
    poolInstance = new pg.Pool({ connectionString: connStr });
    // Si el servidor cierra una conexión inactiva (reinicio, corte de red), el pool emite
    // 'error'. Sin oyente Node lo lanza y tumba la API; con él, el pool descarta esa
    // conexión y abre otra en la siguiente consulta.
    poolInstance.on("error", (error) => {
      console.error("Conexión inactiva de PostgreSQL cerrada:", error.message);
    });
  }
  return poolInstance;
}

export async function cerrarPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
