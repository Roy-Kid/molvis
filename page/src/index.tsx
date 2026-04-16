import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { bootstrapTheme } from "./hooks/useTheme";
import "./styles/tailwind.css";

bootstrapTheme();

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
