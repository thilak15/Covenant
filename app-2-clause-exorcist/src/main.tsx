import { COVENANT_CORE_VERSION } from "@covenant/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Missing application root");
}

createRoot(rootElement).render(
  <StrictMode>
    <main>
      <h1>COVENANT Clause Exorcist</h1>
      <small>Core {COVENANT_CORE_VERSION}</small>
    </main>
  </StrictMode>,
);
