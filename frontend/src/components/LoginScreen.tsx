import React, { useState } from "react";
import type { Usuario } from "@plomada/shared";
import { clienteApi } from "../infrastructure/api/cliente-api";

interface Props {
  onLoginExitoso: (usuario: Usuario) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginExitoso }) => {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correo || !contrasena) return;

    setCargando(true);
    setError(null);

    try {
      const res = await clienteApi.login(correo.trim(), contrasena);
      onLoginExitoso(res.usuario);
    } catch (err) {
      setError("Credenciales incorrectas o servidor no disponible.");
    } finally {
      setCargando(false);
    }
  };

  const loginRapido = async (email: string) => {
    setCorreo(email);
    setContrasena("Plomada2026!");
    setCargando(true);
    setError(null);
    try {
      const res = await clienteApi.login(email, "Plomada2026!");
      onLoginExitoso(res.usuario);
    } catch (err) {
      setError("No se pudo iniciar sesión con las credenciales sembradas.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        backgroundColor: "#f1f5f9",
      }}
    >
      <div
        className="tarjeta"
        style={{
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: "bold",
              color: "#0f172a",
            }}
          >
            Plomada
          </h1>
          <p
            style={{
              color: "var(--color-texto-secundario)",
              fontSize: "0.9rem",
            }}
          >
            Mantenimiento locativo offline-first
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              padding: "0.75rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}
          >
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: "600",
                color: "#334155",
              }}
            >
              Correo electrónico
            </label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="usuario@plomada.local"
              required
              style={{
                padding: "0.6rem",
                borderRadius: "6px",
                border: "1px solid var(--color-borde)",
                fontSize: "1rem",
              }}
            />
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}
          >
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: "600",
                color: "#334155",
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                padding: "0.6rem",
                borderRadius: "6px",
                border: "1px solid var(--color-borde)",
                fontSize: "1rem",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="btn-primario"
            style={{ marginTop: "0.5rem" }}
          >
            {cargando ? "Iniciando..." : "Ingresar"}
          </button>
        </form>

        <div
          style={{
            borderTop: "1px solid var(--color-borde)",
            paddingTop: "1rem",
          }}
        >
          <p
            style={{
              fontSize: "0.8rem",
              color: "#64748b",
              marginBottom: "0.5rem",
              textAlign: "center",
            }}
          >
            Accesos rápidos de demostración:
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
          >
            <button
              type="button"
              onClick={() => void loginRapido("operario1@plomada.local")}
              className="btn-secundario"
              style={{ fontSize: "0.85rem", padding: "0.4rem" }}
            >
              👷 Operario (Juan Carlos Pérez)
            </button>
            <button
              type="button"
              onClick={() => void loginRapido("supervisor@plomada.local")}
              className="btn-secundario"
              style={{ fontSize: "0.85rem", padding: "0.4rem" }}
            >
              🔍 Supervisor de Zona
            </button>
            <button
              type="button"
              onClick={() => void loginRapido("admin@plomada.local")}
              className="btn-secundario"
              style={{ fontSize: "0.85rem", padding: "0.4rem" }}
            >
              ⚙️ Administrador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
