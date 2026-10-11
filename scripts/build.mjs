import { build, context } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
// Der Release-Workflow setzt VERSION (z. B. "1.2.3"), lokal gilt die package.json.
const version = (process.env.VERSION || pkg.version).replace(/^v/, "");

const options = {
  entryPoints: ["src/unifi-network-card.js"],
  outfile: "dist/unifi-network-card.js",
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  legalComments: "none",
  define: { __VERSION__: JSON.stringify(version) },
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching src/ …");
} else {
  await build(options);
}
