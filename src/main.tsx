import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { reportClientError } from "./app/clientErrorReporter";
import "./index.css";

window.addEventListener("error", (event) => {
  reportClientError("window-error", event.error ?? event.message, {
    source: event.filename,
    line: event.lineno,
    column: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientError("unhandled-rejection", event.reason);
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const deployId =
      typeof __MOTUS_DEPLOY_ID__ !== "undefined" ? String(__MOTUS_DEPLOY_ID__ || "").trim() || "local" : "local";
    const reloadedFlag = `motus.sw.reloaded.${deployId}`;

    const triggerOneTimeReload = () => {
      try {
        if (window.sessionStorage.getItem(reloadedFlag) === "1") return;
        window.sessionStorage.setItem(reloadedFlag, "1");
      } catch {
        // ignore storage errors
      }
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", triggerOneTimeReload);

    const pokeUpdate = () =>
      void navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {});

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") pokeUpdate();
    });

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        void registration.update();
      })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
