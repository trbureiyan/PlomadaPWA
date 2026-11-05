import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { PayloadAccessToken, TokenServicePort } from "../../application/ports/token-service.port";
import type { Rol } from "@plomada/shared";

export class JoseTokenService implements TokenServicePort {
  private readonly secretKey: Uint8Array;
  private readonly ttlMinutos: number;

  constructor(secret: string, ttlMinutos = 15) {
    this.secretKey = new TextEncoder().encode(secret);
    this.ttlMinutos = ttlMinutos;
  }

  async generarAccessToken(payload: PayloadAccessToken): Promise<{ token: string; expiraEn: string }> {
    const expiraEnDate = new Date(Date.now() + this.ttlMinutos * 60 * 1000);
    const expiraEnIso = expiraEnDate.toISOString();

    const token = await new SignJWT({
      sub: payload.id,
      correo: payload.correo,
      rol: payload.rol,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiraEnDate.getTime() / 1000))
      .sign(this.secretKey);

    return { token, expiraEn: expiraEnIso };
  }

  async verificarAccessToken(token: string): Promise<PayloadAccessToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        algorithms: ["HS256"],
      });
      return {
        id: payload.sub as string,
        correo: payload.correo as string,
        rol: payload.rol as Rol,
      };
    } catch {
      return null;
    }
  }

  async generarRefreshToken(): Promise<{ token: string; hash: string }> {
    const token = crypto.randomBytes(32).toString("hex");
    const hash = await this.hashRefreshToken(token);
    return { token, hash };
  }

  async hashRefreshToken(token: string): Promise<string> {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
