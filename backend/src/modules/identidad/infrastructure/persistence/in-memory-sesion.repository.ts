import type { SesionRepositoryPort } from "../../application/ports/sesion-repository.port";
import type { Sesion } from "../../domain/sesion";

export class InMemorySesionRepository implements SesionRepositoryPort {
  private readonly sesiones = new Map<string, Sesion>();

  async guardar(sesion: Sesion): Promise<void> {
    this.sesiones.set(sesion.id, { ...sesion });
  }

  async buscarPorTokenHash(tokenHash: string): Promise<Sesion | null> {
    for (const s of this.sesiones.values()) {
      if (s.tokenRefrescoHash === tokenHash) {
        return s;
      }
    }
    return null;
  }

  async revocar(id: string, revocadoEn: Date): Promise<boolean> {
    const sesion = this.sesiones.get(id);
    if (!sesion || sesion.revocadoEn) return false;
    sesion.revocadoEn = revocadoEn;
    return true;
  }

  limpiar(): void {
    this.sesiones.clear();
  }
}
