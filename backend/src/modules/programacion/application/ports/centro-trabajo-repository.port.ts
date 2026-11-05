import type { CentroTrabajo } from "@plomada/shared";

export interface CentroTrabajoRepositoryPort {
  guardar(centro: CentroTrabajo): Promise<void>;
  buscarPorId(id: string): Promise<CentroTrabajo | null>;
  listar(): Promise<CentroTrabajo[]>;
}
