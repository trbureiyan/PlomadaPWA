import type { EstadoSincronizacion } from "./motor-sincronizacion";

type Ocupacion = Pick<
  EstadoSincronizacion,
  "sincronizando" | "elementosPendientes"
>;

export function estaOcupado(estado: Ocupacion): boolean {
  return estado.sincronizando || estado.elementosPendientes > 0;
}

// El estado de una actividad lo deriva el servidor a partir de lo que el celular le envía; solo
// cambia al pedir de nuevo la programación, y eso toca hacerlo cuando la cola termina de vaciarse.
export function terminoDeSincronizar(
  estabaOcupado: boolean,
  estado: Ocupacion,
): boolean {
  return estabaOcupado && !estaOcupado(estado);
}
