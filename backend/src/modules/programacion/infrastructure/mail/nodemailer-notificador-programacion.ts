import nodemailer, { type Transporter } from "nodemailer";
import type {
  NotificacionProgramacionOperario,
  NotificadorProgramacionPort,
} from "../../application/ports/notificador-programacion.port";

export interface OpcionesSmtp {
  host: string;
  port: number;
  remitente: string;
}

export class NodemailerNotificadorProgramacion implements NotificadorProgramacionPort {
  private readonly transporter: Transporter;
  private readonly remitente: string;

  constructor(opciones?: Partial<OpcionesSmtp>) {
    const host = opciones?.host ?? process.env.SMTP_HOST ?? "localhost";
    const port = Number(opciones?.port ?? process.env.SMTP_PORT ?? 1025);
    this.remitente = opciones?.remitente ?? process.env.CORREO_REMITENTE ?? "programacion@plomada.local";

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ignoreTLS: true,
    });
  }

  async notificarOperarios(notificaciones: NotificacionProgramacionOperario[]): Promise<void> {
    for (const notif of notificaciones) {
      try {
        const lineasAsignaciones = notif.asignaciones
          .map((a) => {
            const acts = a.actividades.map((act) => `    - ${act.descripcion}`).join("\n");
            return `• Día ${a.fecha} en ${a.centroTrabajo.nombre}${a.centroTrabajo.direccion ? ` (${a.centroTrabajo.direccion})` : ""}:\n${acts}`;
          })
          .join("\n\n");

        const textoPlano = `Hola ${notif.nombreOperario},\n\nEsta es tu programación de mantenimiento locativo para la semana del ${notif.semanaInicio}:\n\n${lineasAsignaciones}\n\nPor favor consulta los detalles en tu aplicación móvil Plomada PWA.\n`;

        await this.transporter.sendMail({
          from: this.remitente,
          to: notif.correo,
          subject: `Programación semanal Plomada - Semana ${notif.semanaInicio}`,
          text: textoPlano,
        });
      } catch (error) {
        console.error(`Fallo al enviar correo a ${notif.correo}:`, (error as Error).message);
      }
    }
  }
}
