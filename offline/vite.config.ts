import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = fileURLToPath(new URL(".", import.meta.url));

/** 오프라인 설치판 빌드. 결과는 dist-offline/DavidGoliath/app 에 정적 파일로 나온다. */
export default defineConfig({
  root: here,
  publicDir: false,
  plugins: [viteReact(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL("../dist-offline/DavidGoliath/app", import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
});
