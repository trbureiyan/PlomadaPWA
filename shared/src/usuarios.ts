import { z } from "zod";
import { Id, Rol } from "./comunes";

export const Usuario = z.object({
  id: Id,
  nombre: z.string().min(1),
  correo: z.email(),
  rol: Rol,
});
export type Usuario = z.infer<typeof Usuario>;

// El correo solo se valida como bien formado. Restringir el dominio de los
// operarios es una política de cada despliegue, no del contrato (nota 015).
export const UsuarioCrear = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres"),
  correo: z.string().trim().email("Formato de correo electrónico inválido"),
  rol: Rol,
  contrasenaInicial: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .refine(
      (val) => val.trim().length >= 8,
      "La contraseña no puede consistir únicamente de espacios",
    ),
});
export type UsuarioCrear = z.infer<typeof UsuarioCrear>;

export const UsuariosFiltro = z.object({ rol: Rol.optional() });
export type UsuariosFiltro = z.infer<typeof UsuariosFiltro>;
