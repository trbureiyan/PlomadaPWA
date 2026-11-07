import type { Rol } from "@plomada/shared";

export interface PayloadAccessToken {
  id: string;
  correo: string;
  rol: Rol;
}

export interface TokenServicePort {
  generarAccessToken(
    payload: PayloadAccessToken,
  ): Promise<{ token: string; expiraEn: string }>;
  verificarAccessToken(token: string): Promise<PayloadAccessToken | null>;
  generarRefreshToken(): Promise<{ token: string; hash: string }>;
  hashRefreshToken(token: string): Promise<string>;
}
