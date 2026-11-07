import type { RevisionRepositoryPort } from "../../application/ports/revision-repository.port";
import type { RevisionEntidad } from "../../domain/revision";

export class InMemoryRevisionRepository implements RevisionRepositoryPort {
  private readonly revisiones = new Map<string, RevisionEntidad>();

  async guardar(revision: RevisionEntidad): Promise<void> {
    this.revisiones.set(revision.actividadId, { ...revision });
  }

  async buscarPorActividadId(
    actividadId: string,
  ): Promise<RevisionEntidad | null> {
    return this.revisiones.get(actividadId) ?? null;
  }

  async buscarPorActividadesIds(
    actividadesIds: string[],
  ): Promise<Map<string, RevisionEntidad>> {
    const mapa = new Map<string, RevisionEntidad>();
    for (const id of actividadesIds) {
      const rev = this.revisiones.get(id);
      if (rev) {
        mapa.set(id, rev);
      }
    }
    return mapa;
  }

  limpiar(): void {
    this.revisiones.clear();
  }
}
