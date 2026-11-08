import { describe, expect, it } from "vitest";
import { estaOcupado, terminoDeSincronizar } from "./estado-ocupado";

const libre = { sincronizando: false, elementosPendientes: 0 };

describe("estaOcupado", () => {
  it("está ocupado mientras sincroniza o quedan elementos en la cola", () => {
    expect(estaOcupado({ sincronizando: true, elementosPendientes: 0 })).toBe(
      true,
    );
    expect(estaOcupado({ sincronizando: false, elementosPendientes: 2 })).toBe(
      true,
    );
    expect(estaOcupado(libre)).toBe(false);
  });
});

describe("terminoDeSincronizar", () => {
  it("es verdadero solo al pasar de ocupado a libre", () => {
    expect(terminoDeSincronizar(true, libre)).toBe(true);
  });

  it("es falso si ya estaba libre, como en la primera notificación al suscribirse", () => {
    expect(terminoDeSincronizar(false, libre)).toBe(false);
  });

  it("es falso si sigue ocupado", () => {
    expect(
      terminoDeSincronizar(true, {
        sincronizando: false,
        elementosPendientes: 1,
      }),
    ).toBe(false);
  });
});
