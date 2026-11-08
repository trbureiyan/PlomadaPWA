import type { Fecha, SeguimientoDia, SeguimientoFiltro } from "@plomada/shared";
import { hoyEnNegocio } from "../../../compartido/tiempo";
import type { ProveedorSeguimientoPort } from "./ports/proveedor-seguimiento.port";

export class ObtenerSeguimientoDiaUseCase {
  constructor(private readonly proveedor: ProveedorSeguimientoPort) {}

  async ejecutar(filtro?: SeguimientoFiltro): Promise<SeguimientoDia> {
    const fecha = filtro?.fecha ?? hoyEnNegocio();
    return this.proveedor.obtenerSeguimiento(fecha);
  }
}
