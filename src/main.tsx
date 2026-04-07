import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initExternalPersistence } from "./lib/persistence";

async function bootstrap() {
  const queryMode = new URLSearchParams(window.location.search).get("installMode");
  const installMode = queryMode === "client" ? "client" : "server";

  await initExternalPersistence();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App installMode={installMode} />
    </StrictMode>
  );
}

void bootstrap();
