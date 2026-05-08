import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const reloadedFlag = "motus.sw.reloaded";
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
    <App />
  </React.StrictMode>
);