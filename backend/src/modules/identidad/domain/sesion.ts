export interface Sesion {
  id: string;
  usuarioId: string;
  tokenRefrescoHash: string;
  expiraEn: Date;
  revocadoEn?: Date | null;
  creadoEn: Date;
}
