export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  verificar(hash: string, password: string): Promise<boolean>;
}
