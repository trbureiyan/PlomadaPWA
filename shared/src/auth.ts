import { z } from "zod";
import { Instante } from "./comunes";
import { Usuario } from "./usuarios";

export const LoginSolicitud = z.object({
  correo: z.email(),
  contrasena: z.string().min(1),
});
export type LoginSolicitud = z.infer<typeof LoginSolicitud>;

export const RefrescoSolicitud = z.object({
  refreshToken: z.string().min(1),
});
export type RefrescoSolicitud = z.infer<typeof RefrescoSolicitud>;

// El refresh token rota en cada uso: la respuesta trae uno nuevo y el
// anterior deja de servir.
export const SesionRespuesta = z.object({
  accessToken: z.string().min(1),
  accessExpiraEn: Instante,
  refreshToken: z.string().min(1),
  usuario: Usuario,
});
export type SesionRespuesta = z.infer<typeof SesionRespuesta>;
