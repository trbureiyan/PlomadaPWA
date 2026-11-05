import type { CentroTrabajo } from "@plomada/shared";
import type { CentroTrabajoRepositoryPort } from "../../application/ports/centro-trabajo-repository.port";

export class InMemoryCentroTrabajoRepository implements CentroTrabajoRepositoryPort {
  private readonly centros = new Map<string, CentroTrabajo>();

  async guardar(centro: CentroTrabajo): Promise<void> {
    this.centros.set(centro.id, { ...centro });
  }

  async buscarPorId(id: string): Promise<CentroTrabajo | null> {
    return this.centros.get(id) ?? null;
  }

  async listar(): Promise<CentroTrabajo[]> {
    return Array.from(this.centros.values());
  }

  limpiar(): void {
    this.centros.clear();
  }
}
