import { z } from "zod";
import { Id, Rol } from "./comunes";

export const Usuario = z.object({
  id: Id,
  nombre: z.string().min(1),
  correo: z.email(),
  rol: Rol,
});
export type Usuario = z.infer<typeof Usuario>;

export const UsuarioCrear = z
  .object({
    nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres"),
    correo: z.string().trim().email("Formato de correo electrónico inválido"),
    rol: Rol,
    contrasenaInicial: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .refine((val) => val.trim().length >= 8, "La contraseña no puede consistir únicamente de espacios"),
  })
  .refine(
    (u) => {
      if (u.rol === "operario") {
        return u.correo.toLowerCase().trim().endsWith("@plomada.local");
      }
      return true;
    },
    {
      message: "El rol operario exige correo institucional @plomada.local",
      path: ["correo"],
    },
  );
export type UsuarioCrear = z.infer<typeof UsuarioCrear>;

export const UsuariosFiltro = z.object({ rol: Rol.optional() });
export type UsuariosFiltro = z.infer<typeof UsuariosFiltro>;
