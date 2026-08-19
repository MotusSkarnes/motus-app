import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installStaleAppShellRecoveryListeners } from "./app/recoverStaleAppShell";
import "./index.css";

installStaleAppShellRecoveryListeners();

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

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "MOTUS_STALE_SHELL") {
        console.warn("[motus] SW detected stale shell — recovering");
        void import("./app/recoverStaleAppShell").then((m) =>
          m.recoverStaleAppShellOnce(new Error("SW stale shell signal")),
        );
      }
    });

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

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);