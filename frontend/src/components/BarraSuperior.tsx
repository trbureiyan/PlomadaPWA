import React, { useEffect, useState } from "react";
import type { Usuario } from "@plomada/shared";
import {
  motorSincronizacion,
  type EstadoSincronizacion,
} from "../services/motor-sincronizacion";

interface Props {
  usuario: Usuario;
  onCerrarSesion: () => void;
}

export const BarraSuperior: React.FC<Props> = ({ usuario, onCerrarSesion }) => {
  const [syncState, setSyncState] = useState<EstadoSincronizacion>({
    enLinea: typeof navigator !== "undefined" ? navigator.onLine : true,
    sincronizando: false,
    elementosPendientes: 0,
    elementosFallidos: 0,
  });

  useEffect(() => {
    return motorSincronizacion.suscribir(setSyncState);
  }, []);

  const handleSincronizarManual = () => {
    void motorSincronizacion.sincronizarCola();
  };

  return (
    <header
      style={{
        backgroundColor: "#0f172a",
        color: "#ffffff",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "1.25rem",
              fontWeight: "bold",
              letterSpacing: "-0.5px",
            }}
          >
            Plomada
          </span>
          <span
            className={`badge ${syncState.enLinea ? "badge-exito" : "badge-alerta"}`}
            style={{ fontSize: "0.7rem" }}
          >
            {syncState.enLinea ? "● En línea" : "○ Sin conexión"}
          </span>
        </div>

        <button
          onClick={onCerrarSesion}
          style={{
            background: "transparent",
            color: "#94a3b8",
            border: "1px solid #334155",
            fontSize: "0.8rem",
            padding: "0.3rem 0.6rem",
          }}
        >
          Salir
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.85rem",
          color: "#cbd5e1",
          borderTop: "1px solid #1e293b",
          paddingTop: "0.4rem",
        }}
      >
        <div>
          <strong style={{ color: "#f8fafc" }}>{usuario.nombre}</strong>{" "}
          <span style={{ color: "#94a3b8" }}>({usuario.rol})</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {Boolean(
            syncState.elementosFallidos && syncState.elementosFallidos > 0,
          ) && (
            <span
              className="badge badge-peligro"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
            >
              ⚠ {syncState.elementosFallidos} con error
            </span>
          )}

          {syncState.elementosPendientes > 0 ? (
            <button
              onClick={handleSincronizarManual}
              disabled={syncState.sincronizando || !syncState.enLinea}
              className="btn-primario"
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.6rem",
                backgroundColor: syncState.sincronizando
                  ? "#64748b"
                  : "#0284c7",
              }}
            >
              {syncState.sincronizando
                ? "Subiendo..."
                : `Sincronizar (${syncState.elementosPendientes} pendientes)`}
            </button>
          ) : null}

          {syncState.elementosPendientes === 0 &&
          (!syncState.elementosFallidos ||
            syncState.elementosFallidos === 0) ? (
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Al día ✓
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
};
