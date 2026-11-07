import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { solicitarAlmacenamientoPersistente } from "./infrastructure/storage/dexie-db";
import "./index.css";

// Solicitar almacenamiento persistente al arranque de la PWA (nota 011 / C-8)
void solicitarAlmacenamientoPersistente();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
