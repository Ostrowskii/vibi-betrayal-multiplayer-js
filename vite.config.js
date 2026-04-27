import { resolve } from "node:path";

export default {
  base: "./",
  build: {
    assetsDir: "build",
    rollupOptions: {
      input: resolve(process.cwd(), "dev.html"),
    },
  },
};
