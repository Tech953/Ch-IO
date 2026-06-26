import esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(here, "dist");
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: {
    main: path.join(here, "src", "main.ts"),
    preload: path.join(here, "src", "preload.ts"),
  },
  outdir,
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron"],
  sourcemap: false,
  logLevel: "info",
});

cpSync(
  path.join(here, "src", "settings.html"),
  path.join(outdir, "settings.html"),
);

console.log("[desktop] main + preload + settings.html built ->", outdir);
