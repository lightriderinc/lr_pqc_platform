// Domain audit: a domain's public cryptography, seen from outside.
//
//   1. Hosts: certificate transparency logs list every certificate issued
//      for the domain, which names its public hosts. Cert Spotter answers in
//      about a second; crt.sh, the fallback, often takes over 20 seconds.
//   2. Each host: the TLS server check (key exchange and certificate).
//   3. Email signing (DKIM) and DNSSEC keys, from public DNS.
//
// Server only. Full results only for domains the person proves they own,
// with a DNS TXT record whose value is derived from their user id and the
// domain with a server secret: nothing is stored, and it can be re-checked
// at any time. Anyone else gets counts only, with no host names, so the
// audit cannot be used to map someone else's systems.
//
// Network access goes through `AuditDeps`, so tests can supply their own.

import { createHmac, createPublicKey } from "crypto";
import { lookup, Resolver } from "dns/promises";
import { request } from "https";
import type { LookupFunction } from "net";
import { checkServer, CheckError, type ServerCheck } from "./serverCheck";

/** Hosts checked for a verified domain, and for anyone else. */
const MAX_HOSTS_VERIFIED = 20;
const MAX_HOSTS_UNVERIFIED = 8;
/** Hosts checked at once, and the time budget for the whole audit. */
const CONCURRENCY = 5;
const BUDGET_MS = 45_000;
/** Certificate log responses for very large domains can be huge. */
const MAX_LOG_BYTES = 5 * 1024 * 1024;
/** Cert Spotter pages read at most, and the time allowed for each source. */
const MAX_PAGES = 5;
const CERTSPOTTER_TIMEOUT_MS = 8000;
const CRTSH_TIMEOUT_MS = 25_000;

/** DKIM selectors used by common mail services; DKIM keys can only be found by name. */
const DKIM_SELECTORS = [
  "default", "google", "selector1", "selector2", "k1", "k2", "k3", "s1", "s2", "mail", "dkim", "smtp",
  "key1", "key2", "sig1", "mandrill", "pm", "zoho", "protonmail", "fm1", "fm2", "fm3",
];

const DNSSEC_ALGORITHMS: Record<number, string> = {
  5: "RSA/SHA-1",
  7: "RSA/SHA-1 (NSEC3)",
  8: "RSA/SHA-256",
  10: "RSA/SHA-512",
  13: "ECDSA P-256",
  14: "ECDSA P-384",
  15: "Ed25519",
  16: "Ed448",
};

/** Why a fetch failed, so notes can say so. */
export class FetchError extends Error {
  constructor(readonly reason: "timeout" | "rate-limited" | "server" | "too-large" | "unreachable") {
    super(reason);
  }
}

export interface AuditDeps {
  /** GETs JSON from a fixed, trusted service (certificate logs, DNS over HTTPS). */
  fetchJson: (url: string, timeoutMs: number, headers?: Record<string, string>) => Promise<unknown>;
  resolveTxt: (name: string) => Promise<string[][]>;
  checkServer: (host: string, port: number) => Promise<ServerCheck>;
  now: () => Date;
  secret: string | null;
  /** Optional Cert Spotter API key; without one, its free hourly limit applies. */
  certSpotterKey?: string | null;
  /** Time budget for the whole audit; 45 seconds unless a test sets it. */
  budgetMs?: number;
}

export interface HostResult {
  host: string;
  check: ServerCheck | null;
  /** Why the host could not be checked. */
  error: string | null;
}

export interface DkimKey {
  selector: string;
  /** For example "RSA-2048" or "Ed25519"; "revoked" when the record has an empty key. */
  algorithm: string;
  bits: number | null;
}

export interface DnssecInfo {
  signed: boolean;
  /** Algorithms of the zone's keys, with RSA key sizes where readable. */
  keys: { algorithm: string; bits: number | null }[];
}

export interface AuditSummary {
  hostsFound: number;
  hostsChecked: number;
  postQuantum: number;
  postQuantumNotChosen: number;
  classical: number;
  unreachable: number;
  dkimKeys: number;
  dnssec: boolean;
}

export interface DomainAudit {
  domain: string;
  verified: boolean;
  checkedAt: string;
  summary: AuditSummary;
  /** Notes about limits reached or sources that could not be read. */
  notes: string[];
  /** Only for verified domains. */
  hosts: HostResult[] | null;
  dkim: DkimKey[] | null;
  dnssec: DnssecInfo | null;
}

export interface Challenge {
  name: string;
  value: string;
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** The domain from what the person typed: a name, or a URL. */
export function parseDomain(input: string): string {
  let text = input.trim().toLowerCase();
  if (!text) throw new CheckError("Enter a domain, such as example.com.");
  if (text.length > 260) throw new CheckError("That domain is too long.");
  if (text.includes("://")) {
    try {
      text = new URL(text).hostname;
    } catch {
      throw new CheckError("That is not a valid domain.");
    }
  }
  text = text.replace(/^\*\./, "").replace(/\.$/, "");
  if (!HOSTNAME.test(text) || /^[\d.]+$/.test(text)) throw new CheckError("That is not a valid domain.");
  return text;
}

// ---------- ownership ----------

/** The TXT record that proves this person controls this domain. */
export function challengeFor(owner: string, domain: string, secret: string): Challenge {
  const proof = createHmac("sha256", secret).update(`${owner}|${domain}`).digest("hex").slice(0, 32);
  return { name: `_qsearch-challenge.${domain}`, value: `qsearch-verify=${proof}` };
}

/** True when the domain, or a parent of it, carries this person's record. */
async function isVerified(owner: string, domain: string, deps: AuditDeps): Promise<boolean> {
  if (!deps.secret) return false;
  const labels = domain.split(".");
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join(".");
    const { name, value } = challengeFor(owner, candidate, deps.secret);
    try {
      const records = (await deps.resolveTxt(name)).map((chunks) => chunks.join(""));
      if (records.includes(value)) return true;
    } catch {
      /* no record at this level */
    }
  }
  return false;
}

// ---------- hosts ----------

const REASON: Record<FetchError["reason"], string> = {
  timeout: "took too long to answer",
  "rate-limited": "reached its hourly limit",
  server: "returned an error",
  "too-large": "listed too many certificates to read",
  unreachable: "could not be reached",
};

const reasonOf = (e: unknown) => (e instanceof FetchError ? REASON[e.reason] : "gave an unexpected answer");

/** Adds a certificate's names that belong to the domain. Later calls are newer. */
function collect(names: unknown, domain: string, seen: Map<string, number>) {
  if (!Array.isArray(names)) return;
  for (const raw of names) {
    const host = String(raw).trim().toLowerCase().replace(/^\*\./, "");
    if ((host === domain || host.endsWith(`.${domain}`)) && HOSTNAME.test(host)) seen.set(host, seen.size + 1);
  }
}

/** Cert Spotter: unexpired certificates only, oldest discovered first. */
async function fromCertSpotter(domain: string, deps: AuditDeps, seen: Map<string, number>): Promise<void> {
  const headers: Record<string, string> = deps.certSpotterKey ? { authorization: `Bearer ${deps.certSpotterKey}` } : {};
  let after = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}` +
      `&include_subdomains=true&expand=dns_names${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const issuances = await deps.fetchJson(url, CERTSPOTTER_TIMEOUT_MS, headers);
    if (!Array.isArray(issuances)) throw new Error("not a list");
    if (issuances.length === 0) return;
    for (const i of issuances as Record<string, unknown>[]) if (i && typeof i === "object") collect(i.dns_names, domain, seen);
    const last = issuances[issuances.length - 1] as { id?: unknown };
    if (typeof last?.id !== "string" || !last.id) return;
    after = last.id;
  }
}

/** crt.sh: every certificate ever logged; expired ones are skipped here. */
async function fromCrtSh(domain: string, deps: AuditDeps, seen: Map<string, number>): Promise<void> {
  const entries = await deps.fetchJson(
    `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`,
    CRTSH_TIMEOUT_MS,
  );
  if (!Array.isArray(entries)) throw new Error("not a list");
  const now = deps.now().getTime();
  const valid = (entries as Record<string, unknown>[])
    .filter((e) => e && typeof e === "object" && Date.parse(String(e.not_after ?? "")) >= now)
    .sort((a, b) => (Date.parse(String(a.entry_timestamp ?? "")) || 0) - (Date.parse(String(b.entry_timestamp ?? "")) || 0));
  for (const e of valid) collect(String(e.name_value ?? "").split("\n"), domain, seen);
}

/** Public hosts of the domain from certificate logs, most recently certified first. */
async function discoverHosts(domain: string, deps: AuditDeps, notes: string[]): Promise<string[]> {
  const basics = [domain, `www.${domain}`];
  const seen = new Map<string, number>();
  try {
    await fromCertSpotter(domain, deps, seen);
  } catch (first) {
    seen.clear();
    try {
      await fromCrtSh(domain, deps, seen);
      notes.push(`Cert Spotter ${reasonOf(first)}, so hosts were found with crt.sh instead.`);
    } catch (second) {
      notes.push(
        `Certificate logs could not be used (Cert Spotter ${reasonOf(first)}; crt.sh ${reasonOf(second)}), so only the main hosts were checked.`,
      );
      return basics;
    }
  }
  const fromLogs = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  return [...new Set([...basics, ...fromLogs])];
}

/** Runs the checks a few at a time, stopping new ones when the time budget runs out. */
async function checkHosts(hosts: string[], deps: AuditDeps, deadline: number): Promise<HostResult[]> {
  const results: HostResult[] = new Array(hosts.length);
  let next = 0;
  async function worker() {
    while (next < hosts.length) {
      const i = next++;
      const host = hosts[i];
      if (Date.now() > deadline) {
        results[i] = { host, check: null, error: "Not checked: the audit's time limit was reached." };
        continue;
      }
      try {
        results[i] = { host, check: await deps.checkServer(host, 443), error: null };
      } catch (e) {
        results[i] = { host, check: null, error: e instanceof CheckError ? e.message : "Could not be checked." };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, hosts.length) }, worker));
  return results;
}

// ---------- DNS: DKIM and DNSSEC ----------

/** "v=DKIM1; k=rsa; p=…" into its tags. */
function tags(record: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of record.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).replace(/\s+/g, "");
  }
  return out;
}

function rsaBits(der: Buffer): number | null {
  for (const type of ["spki", "pkcs1"] as const) {
    try {
      const key = createPublicKey({ key: der, format: "der", type });
      return key.asymmetricKeyDetails?.modulusLength ?? null;
    } catch {
      /* try the other encoding */
    }
  }
  return null;
}

async function findDkim(domain: string, deps: AuditDeps): Promise<DkimKey[]> {
  const found = await Promise.all(
    DKIM_SELECTORS.map(async (selector): Promise<DkimKey | null> => {
      let records: string[];
      try {
        records = (await deps.resolveTxt(`${selector}._domainkey.${domain}`)).map((c) => c.join(""));
      } catch {
        return null;
      }
      const record = records.find((r) => /(^|;)\s*(v=DKIM1|p=)/i.test(r));
      if (!record) return null;
      const t = tags(record);
      if (!t.p) return { selector, algorithm: "revoked", bits: null };
      const kind = (t.k ?? "rsa").toLowerCase();
      if (kind === "ed25519") return { selector, algorithm: "Ed25519", bits: 256 };
      if (kind !== "rsa" || t.p.length > 2048) return null;
      const bits = rsaBits(Buffer.from(t.p, "base64"));
      return { selector, algorithm: bits ? `RSA-${bits}` : "RSA", bits };
    }),
  );
  return found.filter((k): k is DkimKey => k !== null);
}

/** RSA key size from a DNSKEY's public key (RFC 3110: exponent length, exponent, modulus). */
function dnskeyRsaBits(key: string): number | null {
  const b = Buffer.from(key, "base64");
  if (b.length < 3) return null;
  let expLen = b[0];
  let offset = 1;
  if (expLen === 0) {
    expLen = b.readUInt16BE(1);
    offset = 3;
  }
  let modulus = b.subarray(offset + expLen);
  while (modulus.length && modulus[0] === 0) modulus = modulus.subarray(1);
  return modulus.length ? (modulus.length - 1) * 8 + (32 - Math.clz32(modulus[0])) : null;
}

async function findDnssec(domain: string, deps: AuditDeps, notes: string[]): Promise<DnssecInfo> {
  let reply: unknown;
  try {
    reply = await deps.fetchJson(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=DNSKEY`, 8000);
  } catch {
    notes.push("DNSSEC could not be checked.");
    return { signed: false, keys: [] };
  }
  const answers = ((reply as { Answer?: unknown })?.Answer ?? []) as { type?: number; data?: string }[];
  const keys = new Map<string, { algorithm: string; bits: number | null }>();
  for (const a of Array.isArray(answers) ? answers : []) {
    if (a?.type !== 48 || typeof a.data !== "string") continue;
    const [, , alg, ...rest] = a.data.trim().split(/\s+/);
    const number = Number(alg);
    const algorithm = DNSSEC_ALGORITHMS[number] ?? `algorithm ${number}`;
    const bits = algorithm.startsWith("RSA") ? dnskeyRsaBits(rest.join("")) : null;
    keys.set(`${algorithm}|${bits}`, { algorithm, bits });
  }
  return { signed: keys.size > 0, keys: [...keys.values()] };
}

// ---------- the audit ----------

export async function auditDomain(owner: string, input: string, deps: AuditDeps): Promise<DomainAudit> {
  const domain = parseDomain(input);
  const deadline = Date.now() + (deps.budgetMs ?? BUDGET_MS);
  const notes: string[] = [];
  const verified = await isVerified(owner, domain, deps);

    // Hosts are found and checked as one chain, alongside the DNS lookups, so
  // slow DNS answers never use up the time the host checks need.
  const limit = verified ? MAX_HOSTS_VERIFIED : MAX_HOSTS_UNVERIFIED;
  const hostChain = discoverHosts(domain, deps, notes).then(async (found) => {
    if (found.length > limit) {
      notes.push(
        verified
          ? `${found.length} hosts were found; the ${limit} most recently certified were checked.`
          : `${found.length} hosts were found; ${limit} were checked. Verify ownership to check up to ${MAX_HOSTS_VERIFIED}.`,
      );
    }
    return { found, hosts: await checkHosts(found.slice(0, limit), deps, deadline) };
  });
  const [{ found, hosts }, dkim, dnssec] = await Promise.all([
    hostChain,
    findDkim(domain, deps),
    findDnssec(domain, deps, notes),
  ]);
  const skipped = hosts.filter((h) => h.error?.includes("time limit")).length;
  if (skipped > 0) notes.push(`${skipped} hosts were not checked because the audit's time limit was reached.`);

  const ok = hosts.filter((h) => h.check);
  const summary: AuditSummary = {
    hostsFound: found.length,
    hostsChecked: ok.length,
    postQuantum: ok.filter((h) => h.check!.pqSupport === "default").length,
    postQuantumNotChosen: ok.filter((h) => h.check!.pqSupport === "available").length,
    classical: ok.filter((h) => h.check!.pqSupport === "none" || h.check!.pqSupport === "unknown").length,
    unreachable: hosts.length - ok.length,
    dkimKeys: dkim.length,
    dnssec: dnssec.signed,
  };

  return {
    domain,
    verified,
    checkedAt: deps.now().toISOString(),
    summary,
    notes,
    hosts: verified ? hosts : null,
    dkim: verified ? dkim : null,
    dnssec: verified ? dnssec : null,
  };
}

// ---------- the real network ----------

/**
 * Prefers an IPv4 address when a name has both, like the server check. Many
 * networks (WSL, some offices) have an IPv6 address but no IPv6 route, where
 * connecting to IPv6 first just times out.
 */
const preferIpv4: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }).then(
    (addresses) => {
      const chosen = addresses.find((a) => a.family === 4) ?? addresses[0];
      if (!chosen) return callback(Object.assign(new Error("not found"), { code: "ENOTFOUND" }), "", 4);
      if (options.all) callback(null, [chosen]);
      else callback(null, chosen.address, chosen.family);
    },
    (e) => callback(e, "", 4),
  );
};

/** GET with a timeout and a size cap; only ever called with fixed service URLs. */
function fetchJson(url: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<unknown> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    // Cancelling a request can raise a second error; report only the first.
    let settled = false;
    const fail = (reason: FetchError["reason"], cause?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const code = (cause as NodeJS.ErrnoException | undefined)?.code;
      console.warn(`[qsearch audit] ${target.hostname}: ${reason}${code ? ` (${code})` : ""}`);
      reject(new FetchError(reason));
    };
    const req = request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers: { accept: "application/json", "user-agent": "qSearch (Light Rider)", ...headers },
        lookup: preferIpv4,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status === 429) return res.resume(), fail("rate-limited");
        // Redirects are not followed: these are fixed services.
        if (status < 200 || status >= 300) return res.resume(), fail("server");
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_LOG_BYTES) {
            req.destroy();
            fail("too-large");
          } else chunks.push(chunk);
        });
        res.on("end", () => {
          if (settled) return;
          let parsed: unknown;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch (e) {
            return fail("server", e);
          }
          settled = true;
          clearTimeout(timer);
          resolve(parsed);
        });
      },
    );
    const timer = setTimeout(() => {
      fail("timeout");
      req.destroy();
    }, timeoutMs);
    req.on("error", (e: NodeJS.ErrnoException) => fail(e.code === "ETIMEDOUT" ? "timeout" : "unreachable", e));
    req.end();
  });
}

/** The secret for ownership records. Development falls back to a fixed value, with a warning. */
function verifySecret(): string | null {
  const secret = process.env.QSEARCH_VERIFY_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") {
    console.warn("QSEARCH_VERIFY_SECRET is not set; using a development-only value for domain verification.");
    return "development-only-qsearch-verify-secret";
  }
  return null;
}

/** DNS with short waits: Node's defaults can take over a minute for a name that does not exist. */
const resolver = new Resolver({ timeout: 3000, tries: 2 });

export const realDeps = (): AuditDeps => ({
  fetchJson,
  resolveTxt: (name) => resolver.resolveTxt(name),
  checkServer: (host, port) => checkServer(host, port),
  now: () => new Date(),
  secret: verifySecret(),
  certSpotterKey: process.env.CERTSPOTTER_API_KEY || null,
});