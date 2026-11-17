import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";
import { applyAnimMode } from "./motionPrefs";

applyAnimMode();

registerSW({ immediate: true });

// tylko `npm run dev`: przeglądarka podglądu Claude (w IDE) zawsze ma dane testowe (devSeed.ts, ?seed=1)
if (import.meta.env.DEV) void import("./devSeed").then((m) => m.devAutoSeed());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
