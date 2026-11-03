// Copies the liboqs WebAssembly builds used by the Interop Challenge into
// public/oqs, so the browser can load them directly.
//
// Run from the repo root after installing or upgrading @oqs/liboqs-js:
//     node scripts/copy-liboqs.mjs
//
// Each file is self-contained (the WebAssembly is embedded). The manifest
// records the library version and each file's SHA-256, and the app shows the
// version it actually loaded. Never edit these files by hand.

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const PACKAGE = "node_modules/@oqs/liboqs-js";
const OUT = "public/oqs";
const ALGORITHMS = ["ml-kem-512", "ml-kem-768", "ml-kem-1024", "ml-dsa-44", "ml-dsa-65", "ml-dsa-87"];

const pkg = JSON.parse(readFileSync(`${PACKAGE}/package.json`, "utf8"));
mkdirSync(OUT, { recursive: true });

const files = ALGORITHMS.map((alg) => {
  const file = `${alg}.min.js`;
  copyFileSync(`${PACKAGE}/dist/${file}`, `${OUT}/${file}`);
  const sha256 = createHash("sha256").update(readFileSync(`${OUT}/${file}`)).digest("hex");
  console.log(`copied ${file} (sha256 ${sha256.slice(0, 16)}…)`);
  return { file, sha256 };
});

writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ library: pkg.name, version: pkg.version, files }, null, 2));
console.log(`wrote ${OUT}/manifest.json for ${pkg.name} ${pkg.version}`);