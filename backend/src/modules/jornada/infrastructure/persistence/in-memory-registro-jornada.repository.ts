import type { Fecha, Id } from "@plomada/shared";
import { diaDeNegocio } from "../../../../compartido/tiempo";
import type { RegistroJornadaRepositoryPort } from "../../application/ports/registro-jornada-repository.port";
import type { RegistroJornadaEntidad } from "../../domain/registro-jornada";

export class InMemoryRegistroJornadaRepository implements RegistroJornadaRepositoryPort {
  private readonly registros = new Map<string, RegistroJornadaEntidad>();

  async guardar(registro: RegistroJornadaEntidad): Promise<void> {
    this.registros.set(registro.id, { ...registro });
  }

  async buscarPorId(id: string): Promise<RegistroJornadaEntidad | null> {
    return this.registros.get(id) ?? null;
  }

  async listar(filtro: {
    fecha: Fecha;
    operarioId?: Id;
  }): Promise<RegistroJornadaEntidad[]> {
    return Array.from(this.registros.values()).filter((r) => {
      const fechaRegistro = diaDeNegocio(r.capturadoEn);
      const coincideFecha = fechaRegistro === filtro.fecha;
      const coincideOperario =
        !filtro.operarioId || r.operarioId === filtro.operarioId;
      return coincideFecha && coincideOperario;
    });
  }

  async listarPorActividadId(
    actividadId: string,
  ): Promise<RegistroJornadaEntidad[]> {
    return Array.from(this.registros.values()).filter(
      (r) => r.actividadId === actividadId,
    );
  }

  async listarPorActividadesIds(
    actividadesIds: string[],
  ): Promise<Map<string, RegistroJornadaEntidad[]>> {
    const mapa = new Map<string, RegistroJornadaEntidad[]>();
    for (const id of actividadesIds) {
      mapa.set(id, []);
    }
    for (const r of this.registros.values()) {
      if (r.actividadId && mapa.has(r.actividadId)) {
        mapa.get(r.actividadId)!.push(r);
      }
    }
    return mapa;
  }

  limpiar(): void {
    this.registros.clear();
  }
}
