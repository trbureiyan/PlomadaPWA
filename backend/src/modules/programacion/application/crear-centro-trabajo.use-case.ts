import crypto from "node:crypto";
import type { CentroTrabajo, CentroTrabajoCrear } from "@plomada/shared";
import type { CentroTrabajoRepositoryPort } from "./ports/centro-trabajo-repository.port";

export class CrearCentroTrabajoUseCase {
  constructor(private readonly centroRepo: CentroTrabajoRepositoryPort) {}

  async ejecutar(input: CentroTrabajoCrear): Promise<CentroTrabajo> {
    const centro: CentroTrabajo = {
      id: crypto.randomUUID(),
      nombre: input.nombre.trim(),
      direccion: input.direccion?.trim() || undefined,
    };
    await this.centroRepo.guardar(centro);
    return centro;
  }
}
