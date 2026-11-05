import type { HechosActividad } from "../../domain/estado-actividad";

export interface HechosDeActividadPort {
  obtenerHechosPorActividadId(actividadId: string): Promise<HechosActividad>;
  obtenerHechosPorActividadesIds(actividadesIds: string[]): Promise<Map<string, HechosActividad>>;
}
