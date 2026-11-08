import type { EstadoProgramacion, Fecha, Instante } from "@plomada/shared";
import type {
  ProgramacionPersistida,
  ProgramacionRepositoryPort,
} from "../../application/ports/programacion-repository.port";

export class InMemoryProgramacionRepository implements ProgramacionRepositoryPort {
  private readonly programaciones = new Map<string, ProgramacionPersistida>();

  async guardar(programacion: ProgramacionPersistida): Promise<void> {
    this.programaciones.set(
      programacion.id,
      JSON.parse(JSON.stringify(programacion)),
    );
  }

  async buscarPorId(id: string): Promise<ProgramacionPersistida | null> {
    const p = this.programaciones.get(id);
    return p ? JSON.parse(JSON.stringify(p)) : null;
  }

  async buscarPorSemana(
    semanaInicio: Fecha,
  ): Promise<ProgramacionPersistida | null> {
    for (const p of this.programaciones.values()) {
      if (p.semanaInicio === semanaInicio) {
        return JSON.parse(JSON.stringify(p));
      }
    }
    return null;
  }

  async listar(filtro?: {
    semanaInicio?: Fecha;
  }): Promise<ProgramacionPersistida[]> {
    let lista = Array.from(this.programaciones.values());
    if (filtro?.semanaInicio) {
      lista = lista.filter((p) => p.semanaInicio === filtro.semanaInicio);
    }
    return JSON.parse(JSON.stringify(lista));
  }

  async buscarPublicadaParaOperario(
    operarioId: string,
    semanaInicio?: Fecha,
  ): Promise<ProgramacionPersistida | null> {
    const masRecientePrimero = Array.from(this.programaciones.values()).sort(
      (a, b) => b.semanaInicio.localeCompare(a.semanaInicio),
    );
    for (const p of masRecientePrimero) {
      if (
        p.estado === "publicada" &&
        (!semanaInicio || p.semanaInicio === semanaInicio)
      ) {
        const tieneOperario = p.asignaciones.some(
          (a) => a.operarioId === operarioId,
        );
        if (tieneOperario) {
          return JSON.parse(JSON.stringify(p));
        }
      }
    }
    return null;
  }

  async actualizarEstado(
    id: string,
    estado: EstadoProgramacion,
    publicadaEn: Instante,
  ): Promise<void> {
    const p = this.programaciones.get(id);
    if (p) {
      p.estado = estado;
      p.publicadaEn = publicadaEn;
    }
  }

  limpiar(): void {
    this.programaciones.clear();
  }
}
