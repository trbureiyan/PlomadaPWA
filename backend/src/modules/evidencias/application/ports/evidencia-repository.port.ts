import type { Id } from "@plomada/shared";
import type { EvidenciaEntidad } from "../../domain/evidencia";

export interface EvidenciaRepositoryPort {
  guardar(evidencia: EvidenciaEntidad): Promise<void>;
  buscarPorId(id: Id): Promise<EvidenciaEntidad | null>;
  listarPorActividadId(actividadId: Id): Promise<EvidenciaEntidad[]>;
  listarPorActividadesIds(actividadesIds: Id[]): Promise<Map<Id, EvidenciaEntidad[]>>;
}
