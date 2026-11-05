import type { EvidenciaRepositoryPort } from "../../application/ports/evidencia-repository.port";
import type { EvidenciaEntidad } from "../../domain/evidencia";

export class InMemoryEvidenciaRepository implements EvidenciaRepositoryPort {
  private readonly evidencias = new Map<string, EvidenciaEntidad>();

  async guardar(evidencia: EvidenciaEntidad): Promise<void> {
    this.evidencias.set(evidencia.id, { ...evidencia });
  }

  async buscarPorId(id: string): Promise<EvidenciaEntidad | null> {
    return this.evidencias.get(id) ?? null;
  }

  async listarPorActividadId(actividadId: string): Promise<EvidenciaEntidad[]> {
    return Array.from(this.evidencias.values()).filter((e) => e.actividadId === actividadId);
  }

  async listarPorActividadesIds(actividadesIds: string[]): Promise<Map<string, EvidenciaEntidad[]>> {
    const mapa = new Map<string, EvidenciaEntidad[]>();
    for (const id of actividadesIds) {
      mapa.set(id, []);
    }
    for (const e of this.evidencias.values()) {
      if (mapa.has(e.actividadId)) {
        mapa.get(e.actividadId)!.push(e);
      }
    }
    return mapa;
  }

  limpiar(): void {
    this.evidencias.clear();
  }
}
