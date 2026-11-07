import type { Fecha, Id } from "@plomada/shared";
import type { RegistroJornadaEntidad } from "../../domain/registro-jornada";

export interface RegistroJornadaRepositoryPort {
  guardar(registro: RegistroJornadaEntidad): Promise<void>;
  buscarPorId(id: Id): Promise<RegistroJornadaEntidad | null>;
  listar(filtro: {
    fecha: Fecha;
    operarioId?: Id;
  }): Promise<RegistroJornadaEntidad[]>;
  listarPorActividadId(actividadId: Id): Promise<RegistroJornadaEntidad[]>;
  listarPorActividadesIds(
    actividadesIds: Id[],
  ): Promise<Map<Id, RegistroJornadaEntidad[]>>;
}
