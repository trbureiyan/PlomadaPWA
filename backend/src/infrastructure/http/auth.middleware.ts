import type { NextFunction, Request, Response } from "express";
import type { Rol } from "@plomada/shared";

export interface PayloadAccessToken {
  id: string;
  correo: string;
  rol: Rol;
}

export interface TokenVerifier {
  verificarAccessToken(token: string): Promise<PayloadAccessToken | null>;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: PayloadAccessToken;
    }
  }
}

export function crearAuthMiddleware(tokenService: TokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        codigo: "no_autenticado",
        mensaje: "Token de acceso requerido",
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    const payload = await tokenService.verificarAccessToken(token);

    if (!payload) {
      res.status(401).json({
        codigo: "no_autenticado",
        mensaje: "Token inválido o expirado",
      });
      return;
    }

    req.usuario = payload;
    next();
  };
}

export function exigirRol(...rolesPermitidos: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({
        codigo: "no_autenticado",
        mensaje: "Usuario no autenticado",
      });
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({
        codigo: "sin_permiso",
        mensaje: `El rol ${req.usuario.rol} no tiene permiso para esta acción`,
      });
      return;
    }

    next();
  };
}
