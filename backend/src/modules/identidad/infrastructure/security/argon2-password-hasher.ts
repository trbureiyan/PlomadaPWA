import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasherPort } from "../../application/ports/password-hasher.port";

export class Argon2PasswordHasher implements PasswordHasherPort {
  async hash(password: string): Promise<string> {
    return hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
  }

  async verificar(hashedPassword: string, plainText: string): Promise<boolean> {
    try {
      return await verify(hashedPassword, plainText);
    } catch {
      return false;
    }
  }
}
