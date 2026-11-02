// Builds public/pqc-vectors/nist-acvp.json from NIST's official ACVP test vectors.
//
// Run from the repo root:   node scripts/build-pqc-vectors.mjs
//
// It downloads the vector files straight from NIST's ACVP-Server repository,
// keeps only the test groups the Test Vector Check app runs, and records where
// every file came from with its SHA-256, so anyone can verify the data.
// The vectors are never edited by hand. Rerun this after upgrading
// @noble/post-quantum to test the new version against the same official data.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SOURCE_BASE = "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files";
const SOURCE_PAGE = "https://github.com/usnistgov/ACVP-Server/tree/master/gen-val/json-files";
const OUTPUT = "public/pqc-vectors/nist-acvp.json";

/**
 * Which NIST groups to keep, and which fields each test needs.
 * Only groups whose functions the library exposes are included. Tests the
 * library cannot run (for example the ML-KEM key checks) are left out, never
 * counted as passed.
 */
const SELECTION = [
  {
    id: "ml-kem-keygen",
    folder: "ML-KEM-keyGen-FIPS203",
    keep: () => true,
    fields: ["d", "z", "ek", "dk"],
  },
  {
    id: "ml-kem-encaps",
    folder: "ML-KEM-encapDecap-FIPS203",
    keep: (g) => g.function === "encapsulation",
    fields: ["ek", "m", "c", "k"],
  },
  {
    id: "ml-kem-decaps",
    folder: "ML-KEM-encapDecap-FIPS203",
    keep: (g) => g.function === "decapsulation",
    fields: ["dk", "c", "k", "reason"],
  },
  {
    id: "ml-dsa-keygen",
    folder: "ML-DSA-keyGen-FIPS204",
    keep: () => true,
    fields: ["seed", "pk", "sk"],
  },
  {
    id: "ml-dsa-siggen",
    folder: "ML-DSA-sigGen-FIPS204",
    keep: (g) => g.deterministic === true && g.signatureInterface === "external" && g.preHash === "pure",
    fields: ["sk", "message", "context", "signature"],
  },
  {
    id: "ml-dsa-sigver",
    folder: "ML-DSA-sigVer-FIPS204",
    keep: (g) => g.signatureInterface === "external" && g.preHash === "pure",
    fields: ["pk", "message", "context", "signature", "testPassed", "reason"],
  },
];

const FILE = "internalProjection.json"; // NIST's file holding inputs and expected outputs together

async function download(folder) {
  const url = `${SOURCE_BASE}/${folder}/${FILE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  return { url, sha256: createHash("sha256").update(bytes).digest("hex"), json: JSON.parse(bytes.toString("utf8")) };
}

const cache = new Map();
const files = [];
const functions = [];

for (const sel of SELECTION) {
  if (!cache.has(sel.folder)) {
    const file = await download(sel.folder);
    cache.set(sel.folder, file);
    files.push({ folder: sel.folder, url: file.url, sha256: file.sha256 });
    console.log(`downloaded ${sel.folder} (sha256 ${file.sha256.slice(0, 16)}…)`);
  }
  const { json } = cache.get(sel.folder);
  const groups = json.testGroups.filter(sel.keep).map((g) => ({
    parameterSet: g.parameterSet,
    tests: g.tests.map((t) => {
      const out = { tcId: t.tcId };
      for (const f of sel.fields) {
        if (!(f in t)) throw new Error(`${sel.folder} test ${t.tcId} has no field "${f}"`);
        out[f] = t[f];
      }
      return out;
    }),
  }));
  const count = groups.reduce((n, g) => n + g.tests.length, 0);
  if (count === 0) throw new Error(`No tests selected for ${sel.id}. Has the NIST format changed?`);
  functions.push({ id: sel.id, groups });
  console.log(`  ${sel.id}: ${count} tests`);
}

const library = JSON.parse(readFileSync("node_modules/@noble/post-quantum/package.json", "utf8"));

const output = {
  format: "lightrider-pqc-vectors/1",
  source: { name: "NIST ACVP-Server", page: SOURCE_PAGE, retrieved: new Date().toISOString(), files },
  library: { name: library.name, version: library.version },
  functions,
};

mkdirSync("public/pqc-vectors", { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(output));
const total = functions.reduce((n, f) => n + f.groups.reduce((m, g) => m + g.tests.length, 0), 0);
console.log(`wrote ${OUTPUT}: ${total} tests, ${(JSON.stringify(output).length / 1e6).toFixed(2)} MB`);