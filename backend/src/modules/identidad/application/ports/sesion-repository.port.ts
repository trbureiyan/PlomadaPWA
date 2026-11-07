import type { Sesion } from "../../domain/sesion";

export interface SesionRepositoryPort {
  guardar(sesion: Sesion): Promise<void>;
  buscarPorTokenHash(tokenHash: string): Promise<Sesion | null>;
  /** Revoca solo si seguía vigente. Devuelve false si otra llamada ya la había revocado. */
  revocar(id: string, revocadoEn: Date): Promise<boolean>;
}
