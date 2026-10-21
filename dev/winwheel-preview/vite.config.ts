import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const previewRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: previewRoot,
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    fs: {
      allow: [projectRoot],
    },
  },
});
