import type { Id, Instante, TipoEvidencia } from "@plomada/shared";

export interface EvidenciaEntidad {
  id: Id;
  actividadId: Id;
  operarioId: Id;
  tipo: TipoEvidencia;
  capturadaEn: Instante;
  recibidaEn: Instante;
  tipoMime: "image/jpeg" | "image/webp";
  tamanoBytes: number;
  fotoRuta: string;
}
