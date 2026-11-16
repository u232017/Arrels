import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { MapApp } from "./map/MapApp";

const PilotApp = lazy(() => import("./App").then(({ App }) => ({ default: App })));

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing in index.html");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {new URLSearchParams(window.location.search).get("view") === "detail" ? <Suspense fallback={<p role="status">Carregant la vista pilot…</p>}><PilotApp /></Suspense> : <MapApp />}
    </ErrorBoundary>
  </StrictMode>,
);
