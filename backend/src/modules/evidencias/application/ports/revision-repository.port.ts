import type { Id } from "@plomada/shared";
import type { RevisionEntidad } from "../../domain/revision";

export interface RevisionRepositoryPort {
  guardar(revision: RevisionEntidad): Promise<void>;
  buscarPorActividadId(actividadId: Id): Promise<RevisionEntidad | null>;
  buscarPorActividadesIds(
    actividadesIds: Id[],
  ): Promise<Map<Id, RevisionEntidad>>;
}
