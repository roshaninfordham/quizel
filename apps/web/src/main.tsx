import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { RealtimeProvider } from "./lib/spacetime/client";
import "./theme/styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <RealtimeProvider>
      <App />
    </RealtimeProvider>
  </React.StrictMode>
);
