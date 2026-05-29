import { createRoot } from "react-dom/client";
import App from "@/App";
import "./main.css";

document.documentElement.classList.add("dark");

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
