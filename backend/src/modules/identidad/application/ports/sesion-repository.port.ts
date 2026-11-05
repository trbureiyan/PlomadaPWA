import type { Sesion } from "../../domain/sesion";

export interface SesionRepositoryPort {
  guardar(sesion: Sesion): Promise<void>;
  buscarPorTokenHash(tokenHash: string): Promise<Sesion | null>;
  revocar(id: string, revocadoEn: Date): Promise<void>;
}
