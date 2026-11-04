import { rutas } from "@plomada/shared";
import { expect, it } from "vitest";

// Prueba de humo del workspace: confirma que `shared` se resuelve desde el
// backend. B la borra cuando tenga pruebas reales.
it("resuelve el contrato compartido", () => {
  expect(rutas.iniciarSesion.metodo).toBe("POST");
});
