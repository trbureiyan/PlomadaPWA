import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("C-5: Íconos y favicon de la PWA (D9)", () => {
  const publicDir = path.resolve(__dirname, "../public");

  it("existen los tres archivos requeridos en frontend/public/", () => {
    expect(fs.existsSync(path.join(publicDir, "pwa-192x192.png"))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, "pwa-512x512.png"))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, "favicon.ico"))).toBe(true);
  });

  it("pwa-192x192.png es un archivo PNG válido de exactamente 192x192", () => {
    const filePath = path.join(publicDir, "pwa-192x192.png");
    const buf = fs.readFileSync(filePath);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.subarray(0, 8)).toEqual(pngSignature);

    // IHDR chunk: width at bytes 16..20, height at bytes 20..24
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(192);
    expect(height).toBe(192);
  });

  it("pwa-512x512.png es un archivo PNG válido de exactamente 512x512", () => {
    const filePath = path.join(publicDir, "pwa-512x512.png");
    const buf = fs.readFileSync(filePath);

    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.subarray(0, 8)).toEqual(pngSignature);

    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(512);
    expect(height).toBe(512);
  });

  it("favicon.ico es un archivo ICO válido con cabecera y entradas", () => {
    const filePath = path.join(publicDir, "favicon.ico");
    const buf = fs.readFileSync(filePath);

    // ICO reserved 2 bytes (0), type 2 bytes (1 for ico)
    expect(buf.readUInt16LE(0)).toBe(0);
    expect(buf.readUInt16LE(2)).toBe(1);

    // Number of images >= 1
    const count = buf.readUInt16LE(4);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
