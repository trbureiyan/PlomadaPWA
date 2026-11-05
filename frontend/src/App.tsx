import React, { useEffect, useState } from "react";
import type { Usuario } from "@plomada/shared";
import { BarraSuperior } from "./components/BarraSuperior";
import { LoginScreen } from "./components/LoginScreen";
import { OperarioDashboard } from "./components/OperarioDashboard";
import { SupervisorDashboard } from "./components/SupervisorDashboard";
import { db } from "./infrastructure/storage/dexie-db";

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Verificar si hay sesión activa en Dexie
    void db.sesion.get("activa").then((sesion) => {
      if (sesion?.usuario) {
        setUsuario(sesion.usuario);
      }
      setCargando(false);
    });
  }, []);

  const handleCerrarSesion = async () => {
    await db.sesion.delete("activa");
    setUsuario(null);
  };

  if (cargando) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#64748b",
        }}
      >
        Cargando Plomada...
      </div>
    );
  }

  if (!usuario) {
    return <LoginScreen onLoginExitoso={(u) => setUsuario(u)} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <BarraSuperior usuario={usuario} onCerrarSesion={() => void handleCerrarSesion()} />
      <main style={{ flex: 1, paddingBottom: "2rem" }}>
        {usuario.rol === "operario" ? (
          <OperarioDashboard usuario={usuario} />
        ) : (
          <SupervisorDashboard usuario={usuario} />
        )}
      </main>
    </div>
  );
}
