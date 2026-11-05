import type { Fecha, SeguimientoDia, SeguimientoFiltro } from "@plomada/shared";
import type { ProveedorSeguimientoPort } from "./ports/proveedor-seguimiento.port";

export class ObtenerSeguimientoDiaUseCase {
  constructor(private readonly proveedor: ProveedorSeguimientoPort) {}

  async ejecutar(filtro?: SeguimientoFiltro): Promise<SeguimientoDia> {
    const fecha = filtro?.fecha ?? new Date().toISOString().slice(0, 10);
    return this.proveedor.obtenerSeguimiento(fecha);
  }
}
