import type { Rol } from "@plomada/shared";

export interface UsuarioConContrasena {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  contrasenaHash: string;
  creadoEn: Date;
}

export interface UsuarioPublico {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
}
