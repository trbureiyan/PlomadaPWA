import type { Id } from "@plomada/shared";
import type { EvidenciaEntidad } from "../../domain/evidencia";

export interface EvidenciaRepositoryPort {
  /** true si la guardó; false si ya existía una evidencia con ese id (otro envío ganó la carrera). */
  guardar(evidencia: EvidenciaEntidad): Promise<boolean>;
  buscarPorId(id: Id): Promise<EvidenciaEntidad | null>;
  listarPorActividadId(actividadId: Id): Promise<EvidenciaEntidad[]>;
  listarPorActividadesIds(actividadesIds: Id[]): Promise<Map<Id, EvidenciaEntidad[]>>;
}
