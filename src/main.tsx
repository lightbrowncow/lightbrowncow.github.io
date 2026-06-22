import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("SW registered", reg))
      .catch((err) => console.error("SW registration failed:", err));
  });
}
