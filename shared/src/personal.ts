import { z } from "zod";
import { Fecha, Id } from "./comunes";

// Borrador de prioridad P2. B y A lo ajustan por PR cuando el módulo
// `personal` entre en alcance; hasta entonces nadie depende de estos campos.
export const HojaDeVida = z.object({
  operarioId: Id,
  nombreCompleto: z.string().min(1),
  tipoDocumento: z.enum(["CC", "CE", "otro"]),
  numeroDocumento: z.string().min(1),
  telefono: z.string().optional(),
  cargo: z.string().min(1),
  fechaIngreso: Fecha,
  formacion: z.array(z.string()),
  experiencia: z.array(z.string()),
});
export type HojaDeVida = z.infer<typeof HojaDeVida>;

// El operarioId va en la URL (PUT /operarios/:id/hoja-de-vida).
export const HojaDeVidaGuardar = HojaDeVida.omit({ operarioId: true });
export type HojaDeVidaGuardar = z.infer<typeof HojaDeVidaGuardar>;
