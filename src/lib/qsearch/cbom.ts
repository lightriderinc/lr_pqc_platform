// Builds a CycloneDX 1.6 CBOM from qSearch findings, using the standard
// cryptoProperties fields so other tools can read algorithm, key size,
// curve, quantum security level and certificates. Pure: runs in the browser.

import { describeAlgorithm, type AlgorithmInfo } from "./algorithms";

export interface CbomFinding {
  algorithm: string;
  classification: string;
  risk: string;
  asset: string;
  evidence: string;
  service: string;
  keyBits?: number | null;
  parameterSet?: string | null;
  certificate?: { subject: string; issuer: string; notValidBefore: string; notValidAfter: string } | null;
}

type Occurrence = { location: string; line?: number; additionalContext?: string };

interface Component {
  type: "cryptographic-asset" | "library";
  "bom-ref": string;
  name: string;
  cryptoProperties?: Record<string, unknown>;
  properties?: { name: string; value: string }[];
  evidence: { occurrences: Occurrence[] };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unnamed";

/** "RSA-2048", "ECDSA/ECDH P-256", "ML-KEM-768", or the name qSearch gave. */
function displayName(info: AlgorithmInfo | null, f: CbomFinding): string {
  if (!info) return f.algorithm;
  if (!info.parameterSet) return info.family;
  return info.family === "ECDSA/ECDH" || (info.family === "RSA/EC" && !/^\d+$/.test(info.parameterSet))
    ? `${info.family} ${info.parameterSet}`
    : `${info.family}-${info.parameterSet}`;
}

function occurrence(f: CbomFinding): Occurrence {
  const line = /^(.+):(\d+)$/.exec(f.evidence);
  if (line) return { location: line[1], line: Number(line[2]) };
  return f.evidence ? { location: f.asset, additionalContext: f.evidence } : { location: f.asset };
}

export function buildCbom(
  findings: CbomFinding[],
  meta: { project: string; timestamp: string; serial: string },
): Record<string, unknown> {
  const components = new Map<string, Component>();

  function add(component: Omit<Component, "evidence">, where: Occurrence) {
    const existing = components.get(component["bom-ref"]);
    const target = existing ?? { ...component, evidence: { occurrences: [] } };
    if (!target.evidence.occurrences.some((o) => JSON.stringify(o) === JSON.stringify(where))) {
      target.evidence.occurrences.push(where);
    }
    components.set(component["bom-ref"], target);
  }

  for (const f of findings) {
    const info = describeAlgorithm(f.algorithm, f.service, f);
    const where = occurrence(f);

    if (!info && f.classification === "context") {
      add({ type: "library", "bom-ref": `library/${slug(f.algorithm)}`, name: f.algorithm }, where);
      continue;
    }

    const name = displayName(info, f);
    const primitive = info?.primitive ?? "unknown";
    const ref = `crypto/algorithm/${slug(name)}/${primitive}`;
    add(
      {
        type: "cryptographic-asset",
        "bom-ref": ref,
        name,
        cryptoProperties: {
          assetType: "algorithm",
          algorithmProperties: {
            primitive,
            ...(info?.parameterSet && { parameterSetIdentifier: info.parameterSet }),
            ...(info?.curve && { curve: info.curve }),
            ...(info?.quantumLevel != null && { nistQuantumSecurityLevel: info.quantumLevel }),
          },
        },
        properties: [{ name: "lightrider:classification", value: f.classification }],
      },
      where,
    );

    if (f.certificate) {
      const fingerprint = f.evidence.replace(/^sha256:/i, "");
      add(
        {
          type: "cryptographic-asset",
          "bom-ref": `crypto/certificate/${slug(fingerprint)}`,
          name: f.certificate.subject || fingerprint,
          cryptoProperties: {
            assetType: "certificate",
            certificateProperties: {
              subjectName: f.certificate.subject,
              issuerName: f.certificate.issuer,
              // Left out when unreadable: CycloneDX requires a real date here.
              ...(f.certificate.notValidBefore ? { notValidBefore: f.certificate.notValidBefore } : {}),
              ...(f.certificate.notValidAfter ? { notValidAfter: f.certificate.notValidAfter } : {}),
              subjectPublicKeyRef: ref,
              certificateFormat: "X.509",
            },
          },
        },
        where,
      );
    }
  }

  return {
    $schema: "http://cyclonedx.org/schema/bom-1.6.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${meta.serial}`,
    version: 1,
    metadata: {
      timestamp: meta.timestamp,
      tools: { components: [{ type: "application", name: "qSearch", publisher: "Light Rider Inc" }] },
      component: { type: "application", "bom-ref": "scanned-project", name: meta.project },
    },
    components: [...components.values()],
  };
}