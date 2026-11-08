import type {
  Fecha,
  Id,
  SeguimientoDia,
  SeguimientoFiltro,
} from "@plomada/shared";

export interface ProveedorSeguimientoPort {
  obtenerSeguimiento(fecha: Fecha): Promise<SeguimientoDia>;
}
