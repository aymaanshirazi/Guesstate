import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Two builds from one codebase:
//  - `npm run build`        -> dist/      (web: split assets, absolute base, deployed to Cloudflare)
//  - `npm run build:itch`   -> dist-itch/ (itch.io: everything inlined into a single self-contained
//                                          index.html with relative paths, so it works inside itch's iframe)
// The data files (countries.geojson, cities.json) stay external and are fetched at runtime via the
// base URL, so they sit next to index.html in the zip.
export default defineConfig(({ mode }) => {
  const itch = mode === "itch";
  return {
    base: itch ? "./" : "/",
    plugins: itch ? [viteSingleFile()] : [],
    build: {
      outDir: itch ? "dist-itch" : "dist",
      chunkSizeWarningLimit: 3000,
    },
  };
});
