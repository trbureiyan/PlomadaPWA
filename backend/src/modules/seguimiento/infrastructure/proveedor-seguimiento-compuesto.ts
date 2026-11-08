import type { Fecha, Id, SeguimientoDia } from "@plomada/shared";
import type { RegistroJornadaRepositoryPort } from "../../jornada";
import {
  derivarEstado,
  type ConsultaProgramacionPort,
  type HechosDeActividadPort,
} from "../../programacion";
import type { ProveedorSeguimientoPort } from "../application/ports/proveedor-seguimiento.port";

export type ListarOperarios = () => Promise<Array<{ id: Id; nombre: string }>>;

// Solo lectura: arma el día con lo que exponen identidad (operarios),
// programacion (actividades publicadas), jornada y los hechos de la actividad.
export class ProveedorSeguimientoCompuesto implements ProveedorSeguimientoPort {
  constructor(
    private readonly listarOperarios: ListarOperarios,
    private readonly programacion: ConsultaProgramacionPort,
    private readonly hechosDeActividad: HechosDeActividadPort,
    private readonly jornada: Pick<RegistroJornadaRepositoryPort, "listar">,
  ) {}

  async obtenerSeguimiento(fecha: Fecha): Promise<SeguimientoDia> {
    const operarios = await this.listarOperarios();
    const delDia = await this.programacion.listarActividades({
      fecha,
      soloPublicadas: true,
    });
    const hechosMap =
      await this.hechosDeActividad.obtenerHechosPorActividadesIds(
        delDia.map((a) => a.id),
      );
    const jornadasDelDia = await this.jornada.listar({ fecha });

    return {
      fecha,
      generadoEn: new Date().toISOString(),
      operarios: operarios.map((op) => {
        const actividadesOp = delDia.filter((a) => a.operarioId === op.id);
        const primera = actividadesOp[0];
        const jornadasOp = jornadasDelDia.filter((j) => j.operarioId === op.id);
        const entrada = jornadasOp.find((j) => j.tipo === "entrada_centro");
        const salida = jornadasOp
          .slice()
          .reverse()
          .find((j) => j.tipo === "salida_centro");

        return {
          operario: { id: op.id, nombre: op.nombre },
          centroTrabajo: primera
            ? {
                id: primera.centroTrabajoId,
                nombre: primera.centroTrabajoNombre,
                direccion: primera.centroTrabajoDireccion,
              }
            : null,
          entradaEn: entrada?.capturadoEn ?? null,
          salidaEn: salida?.capturadoEn ?? null,
          actividades: actividadesOp.map((a) => {
            const hechos = hechosMap.get(a.id) ?? {};
            return {
              id: a.id,
              descripcion: a.descripcion,
              estado: derivarEstado(hechos),
              evidenciasRecibidas: hechos.evidencias?.length ?? 0,
            };
          }),
        };
      }),
    };
  }
}
