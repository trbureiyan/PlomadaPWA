import React, { useEffect, useState } from "react";
import { clienteApi } from "../infrastructure/api/cliente-api";

interface Props {
  evidenciaId: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
}

export const FotoProtegida: React.FC<Props> = ({ evidenciaId, alt, style, className }) => {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activa = true;
    let urlCreada: string | null = null;

    setCargando(true);
    setError(false);

    clienteApi
      .obtenerFotoBlob(evidenciaId)
      .then((blob) => {
        if (!activa) return;
        urlCreada = URL.createObjectURL(blob);
        setFotoUrl(urlCreada);
        setCargando(false);
      })
      .catch((err) => {
        if (!activa) return;
        console.error("Error cargando foto protegida:", err);
        setError(true);
        setCargando(false);
      });

    return () => {
      activa = false;
      if (urlCreada) {
        URL.revokeObjectURL(urlCreada);
      }
    };
  }, [evidenciaId]);

  if (cargando) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e2e8f0",
          color: "#64748b",
          fontSize: "0.8rem",
          ...style,
        }}
      >
        Cargando foto...
      </div>
    );
  }

  if (error || !fotoUrl) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fee2e2",
          color: "#991b1b",
          fontSize: "0.8rem",
          padding: "0.5rem",
          textAlign: "center",
          ...style,
        }}
      >
        No se pudo cargar la imagen
      </div>
    );
  }

  return (
    <img
      src={fotoUrl}
      alt={alt}
      style={style}
      className={className}
      loading="lazy"
    />
  );
};
