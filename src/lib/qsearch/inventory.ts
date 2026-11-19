// Federal cryptographic inventory: the nine data items OMB M-23-02 (Section
// II.A) asks for each information system, with priority and target phase
// from OMB M-26-15 (June 24, 2026). Item 4 comes from the scan; the other
// items describe the system and only its owner can supply them.
// Pure: used in the browser (form, export) and on the server (validation).

import { describeAlgorithm, keyLabel } from "./algorithms";
import { isComment, isTestPath } from "./tags";

export const FIPS_199 = ["Low", "Moderate", "High"] as const;
export const SOFTWARE_TYPES = ["COTS", "GOTS", "Other"] as const;
export const HOSTING = ["On premise", "Commercial cloud", "Government cloud", "Hybrid"] as const;

export interface SystemDetails {
  /** 1. FISMA system identifier. An identifier only, never a descriptive name. */
  fismaId: string;
  /** 2. FIPS 199 system categorization. */
  fips199: (typeof FIPS_199)[number] | "";
  /** 3. HVA identifier, if a High Value Asset. */
  hvaId: string;
  /** 5. Software package type and vendor or developer. */
  softwareType: (typeof SOFTWARE_TYPES)[number] | "";
  vendor: string;
  /** 6. Operating systems with major and minor versions. */
  operatingSystems: string;
  /** 7. Where the system is hosted, and the provider when not on premise. */
  hosting: (typeof HOSTING)[number] | "";
  hostingProvider: string;
  /** 8. Types of data, and how many years the data needs protection. */
  dataTypes: string;
  protectYears: number | null;
  /** 9. Any other notes. */
  notes: string;
}

export const EMPTY_SYSTEM: SystemDetails = {
  fismaId: "",
  fips199: "",
  hvaId: "",
  softwareType: "",
  vendor: "",
  operatingSystems: "",
  hosting: "",
  hostingProvider: "",
  dataTypes: "",
  protectYears: null,
  notes: "",
};

const LIMITS: Record<Exclude<keyof SystemDetails, "fips199" | "softwareType" | "hosting" | "protectYears">, number> = {
  fismaId: 64,
  hvaId: 64,
  vendor: 120,
  operatingSystems: 200,
  hostingProvider: 120,
  dataTypes: 300,
  notes: 1000,
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const oneOf = <T extends string>(value: unknown, options: readonly T[]): T | "" =>
  options.includes(value as T) ? (value as T) : "";

/** System details from untrusted input: unknown fields dropped, text trimmed and capped. */
export function cleanSystem(input: unknown): SystemDetails {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const years = Number(v.protectYears);
  return {
    fismaId: text(v.fismaId, LIMITS.fismaId),
    fips199: oneOf(v.fips199, FIPS_199),
    hvaId: text(v.hvaId, LIMITS.hvaId),
    softwareType: oneOf(v.softwareType, SOFTWARE_TYPES),
    vendor: text(v.vendor, LIMITS.vendor),
    operatingSystems: text(v.operatingSystems, LIMITS.operatingSystems),
    hosting: oneOf(v.hosting, HOSTING),
    hostingProvider: text(v.hostingProvider, LIMITS.hostingProvider),
    dataTypes: text(v.dataTypes, LIMITS.dataTypes),
    protectYears:
      v.protectYears === null || v.protectYears === "" || !Number.isFinite(years)
        ? null
        : Math.min(100, Math.max(0, Math.round(years))),
    notes: text(v.notes, LIMITS.notes),
  };
}

/** Items the owner still needs to fill in, by name. */
export function missingItems(s: SystemDetails): string[] {
  const missing: string[] = [];
  if (!s.fismaId) missing.push("FISMA system identifier");
  if (!s.fips199) missing.push("FIPS 199 categorization");
  if (!s.softwareType || !s.vendor) missing.push("software type and vendor");
  if (!s.operatingSystems) missing.push("operating systems");
  if (!s.hosting || (s.hosting !== "On premise" && !s.hostingProvider)) missing.push("hosting");
  if (!s.dataTypes || s.protectYears === null) missing.push("data types and protection period");
  return missing;
}

/** Asymmetric algorithm families a quantum computer breaks (M-26-15 Appendix A). */
const CRQC_VULNERABLE = new Set(["RSA", "RSA/EC", "ECDSA/ECDH", "DH", "DSA", "Ed25519", "Ed448", "X25519", "X448"]);

const KEY_ESTABLISHMENT = /key establishment|encrypted connection|encrypt/i;
const SIGNATURE = /signature|authentication/i;

/** Families that can only sign, or only agree keys, whatever the finding says. */
const SIGN_ONLY = new Set(["DSA", "Ed25519", "Ed448"]);
const AGREE_ONLY = new Set(["DH", "X25519", "X448"]);

/** What the cryptographic system is used for (M-23-02 "service provided"). */
function serviceUse(service: string, family: string): string {
  const signs = SIGN_ONLY.has(family);
  const agrees = AGREE_ONLY.has(family);
  // Key files say nothing about use beyond what the algorithm allows.
  if (/key material at rest/i.test(service)) {
    return signs ? "stored signing key" : agrees ? "stored key-agreement key" : "stored key";
  }
  if (/public key material/i.test(service)) {
    return signs ? "public signing key" : agrees ? "public key-agreement key" : "public key";
  }
  if (signs) return "digital signatures";
  if (agrees) return "key establishment";
  const ke = KEY_ESTABLISHMENT.test(service);
  const sig = SIGNATURE.test(service);
  return sig && !ke ? "digital signatures" : ke && !sig ? "key establishment" : "key establishment and signatures";
}

export interface InventoryFinding {
  algorithm: string;
  classification: string;
  confidence: string;
  service: string;
  asset: string;
  evidence: string;
  keyBits?: number | null;
  parameterSet?: string | null;
}

export interface InventoryRow {
  algorithm: string;
  service: string;
  keyLength: string;
  occurrences: number;
  locations: string[];
  /** M-26-15 phase this cryptographic system should be migrated in. */
  target: string;
}

/** Systems M-26-15 tells agencies to migrate first. */
export function isPriority(s: SystemDetails, asOf: Date): boolean {
  const sensitiveIn2030 = s.protectYears !== null && asOf.getFullYear() + s.protectYears >= 2030;
  return s.fips199 === "High" || !!s.hvaId || sensitiveIn2030;
}

const SIGNING_USES = new Set(["digital signatures", "stored signing key", "public signing key"]);

function targetFor(use: string, priority: boolean): string {
  if (!priority) return "Phase 5: by 2035";
  // Signing-only systems migrate in the signature phase; anything that may
  // establish keys migrates first, because recorded traffic is at risk now.
  if (SIGNING_USES.has(use)) return "Phase 4: PQC signatures, 2031";
  return "Phase 3: PQC key establishment, 2028 to 2030";
}

/**
 * Item 4: each quantum-vulnerable cryptographic system in the scan, one row
 * per algorithm, use and key length. Comments are left out; test files are
 * left out unless asked for, since M-23-02 covers actively used systems.
 */
export function inventoryRows(
  findings: InventoryFinding[],
  system: SystemDetails,
  options: { includeTests: boolean; asOf: Date },
): InventoryRow[] {
  const priority = isPriority(system, options.asOf);
  const rows = new Map<string, InventoryRow>();
  for (const f of findings) {
    if (f.classification !== "quantum-vulnerable" || isComment(f)) continue;
    if (!options.includeTests && isTestPath(f.asset)) continue;
    const info = describeAlgorithm(f.algorithm, f.service, f);
    if (!info || !CRQC_VULNERABLE.has(info.family)) continue;
    const use = serviceUse(f.service, info.family);
    const keyLength = keyLabel(f) ?? "Not stated";
    const key = JSON.stringify([info.family, use, keyLength]);
    const row = rows.get(key) ?? {
      algorithm: info.family,
      service: use,
      keyLength,
      occurrences: 0,
      locations: [],
      target: targetFor(use, priority),
    };
    row.occurrences += 1;
    const where = f.evidence.startsWith("sha256:") ? f.asset : f.evidence;
    if (!row.locations.includes(where)) row.locations.push(where);
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.algorithm.localeCompare(b.algorithm) || b.occurrences - a.occurrences);
}

const COLUMNS = [
  "FISMA system identifier",
  "FIPS 199 categorization",
  "HVA identifier",
  "Algorithm",
  "Service",
  "Key length",
  "Occurrences",
  "Locations",
  "Software type",
  "Vendor or developer",
  "Operating systems",
  "Hosting",
  "Hosting provider",
  "Data types",
  "Protection period (years)",
  "M-26-15 priority",
  "Target phase",
  "Notes",
  "Source",
];

/**
 * A spreadsheet cell. Text starting with = + - @ or a control character is
 * prefixed with ' so spreadsheet programs show it instead of running it.
 */
function cell(value: string | number | null): string {
  let s = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Locations listed per row; the rest are counted. */
const MAX_LOCATIONS = 20;

function rowValues(row: InventoryRow, s: SystemDetails, priority: boolean, source: string) {
  const shown = row.locations.slice(0, MAX_LOCATIONS).join("; ");
  const more = row.locations.length - MAX_LOCATIONS;
  return [
    s.fismaId,
    s.fips199,
    s.hvaId,
    row.algorithm,
    row.service,
    row.keyLength,
    row.occurrences,
    more > 0 ? `${shown}; and ${more} more` : shown,
    s.softwareType,
    s.vendor,
    s.operatingSystems,
    s.hosting,
    s.hostingProvider,
    s.dataTypes,
    s.protectYears,
    priority ? "Yes" : "No",
    row.target,
    s.notes,
    source,
  ];
}

export function inventoryCsv(rows: InventoryRow[], s: SystemDetails, asOf: Date, source: string): string {
  const priority = isPriority(s, asOf);
  const lines = [COLUMNS, ...rows.map((r) => rowValues(r, s, priority, source))];
  // A byte-order mark so Excel opens the file as UTF-8.
  return "\uFEFF" + lines.map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function inventoryJson(rows: InventoryRow[], s: SystemDetails, asOf: Date, source: string): string {
  return JSON.stringify(
    {
      format: "OMB M-23-02 Section II.A data items, with OMB M-26-15 priority",
      generated: asOf.toISOString(),
      source,
      system: { ...s, priority: isPriority(s, asOf) },
      cryptographicSystems: rows,
    },
    null,
    2,
  );
}