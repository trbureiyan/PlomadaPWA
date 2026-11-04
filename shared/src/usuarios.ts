import { z } from "zod";
import { Id, Rol } from "./comunes";

export const Usuario = z.object({
  id: Id,
  nombre: z.string().min(1),
  correo: z.email(),
  rol: Rol,
});
export type Usuario = z.infer<typeof Usuario>;

export const UsuarioCrear = z.object({
  nombre: z.string().min(1),
  correo: z.email(),
  rol: Rol,
  contrasenaInicial: z.string().min(8),
});
export type UsuarioCrear = z.infer<typeof UsuarioCrear>;

export const UsuariosFiltro = z.object({ rol: Rol.optional() });
export type UsuariosFiltro = z.infer<typeof UsuariosFiltro>;
