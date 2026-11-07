/**
 * Genera un UUID v4 seguro compatible con RFC 4122.
 * En contextos no seguros (ej. HTTP en dispositivos móviles sobre red local),
 * crypto.randomUUID no está disponible en la API Web Crypto del navegador.
 * En tales circunstancias, implementa un fallback compatible con RFC 4122 v4.
 */
export const generarUUIDSeguro = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
