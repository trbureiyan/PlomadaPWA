import type { RegistroJornada, RegistrosJornadaFiltro } from "@plomada/shared";
import type { RegistroJornadaRepositoryPort } from "./ports/registro-jornada-repository.port";

export class ListarRegistrosJornadaUseCase {
  constructor(private readonly jornadaRepo: RegistroJornadaRepositoryPort) {}

  async ejecutar(filtro: RegistrosJornadaFiltro): Promise<RegistroJornada[]> {
    const entidades = await this.jornadaRepo.listar(filtro);
    return entidades.map((entidad) => {
      if (entidad.tipo === "entrada_centro" || entidad.tipo === "salida_centro") {
        return {
          id: entidad.id,
          operarioId: entidad.operarioId,
          tipo: entidad.tipo,
          centroTrabajoId: entidad.centroTrabajoId!,
          capturadoEn: entidad.capturadoEn,
          recibidoEn: entidad.recibidoEn,
        };
      }
      return {
        id: entidad.id,
        operarioId: entidad.operarioId,
        tipo: entidad.tipo,
        actividadId: entidad.actividadId!,
        capturadoEn: entidad.capturadoEn,
        recibidoEn: entidad.recibidoEn,
      };
    });
  }
}
