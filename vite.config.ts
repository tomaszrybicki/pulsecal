import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // `npm run dev` na 5174: port 5173 zajmuje stały serwer z ostatniego commita (scripts/serve.mjs)
  server: { port: 5174, strictPort: true, watch: { ignored: ["**/.serve/**"] } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Pulsecal",
        short_name: "Pulsecal",
        description: "Kalendarz jak mapa — lokalnie, z kopią w Google Calendar",
        theme_color: "#efe8dc",
        background_color: "#efe8dc",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        lang: "pl",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
