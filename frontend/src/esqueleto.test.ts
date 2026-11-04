import { LIMITES_EVIDENCIA } from "@plomada/shared";
import { expect, it } from "vitest";

// Prueba de humo del workspace: confirma que `shared` se resuelve desde el
// frontend. C la borra cuando tenga pruebas reales.
it("resuelve el contrato compartido", () => {
  expect(LIMITES_EVIDENCIA.campoArchivo).toBe("foto");
});
