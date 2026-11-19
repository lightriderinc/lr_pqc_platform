"use client";

import { runServerCheck, type ServerCheckResult } from "@/app/qsearch/actions";
import Badge from "@/components/ui/Badge";
import DownloadButton from "@/components/ui/DownloadButton";
import LRButton from "@/components/ui/LRButton";
import SectionPanel from "@/components/ui/SectionPanel";
import TableShell from "@/components/ui/TableShell";
import { buildCbom } from "@/lib/qsearch/cbom";
import type { PqSupport } from "@/lib/qsearch/serverCheck";
import { useMemo, useState } from "react";
import { MdLanguage } from "react-icons/md";

/** Ports offered in the picker; the server accepts the same list. */
const PORTS = [443, 8443, 4443, 9443, 6443, 465, 636, 853, 993, 995, 5061];

const VERDICT: Record<PqSupport, { label: string; variant: "ready" | "warn" | "vulnerable" | "neutral"; text: string }> = {
  default: {
    label: "Quantum-safe key exchange",
    variant: "ready",
    text: "Clients that offer X25519MLKEM768, as current browsers do, get a post-quantum hybrid key exchange. Traffic recorded today stays protected against a future quantum computer.",
  },
  available: {
    label: "Post-quantum supported, not chosen",
    variant: "warn",
    text: "The server supports X25519MLKEM768 but picked a classical group when offered both. Change its group preference so post-quantum comes first.",
  },
  none: {
    label: "Classical key exchange only",
    variant: "vulnerable",
    text: "Traffic recorded today could be decrypted once a large quantum computer exists (harvest now, decrypt later). Enable X25519MLKEM768: OpenSSL 3.5 or later, or a CDN or load balancer that supports it.",
  },
  unknown: {
    label: "Post-quantum support unknown",
    variant: "neutral",
    text: "The server chose a classical group, and the follow-up check for post-quantum support did not complete.",
  },
};

const quantumSafe = (algorithm: string) => algorithm.startsWith("ML-");

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[140px_1fr]">
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-words text-gray-800">{children}</dd>
    </div>
  );
}

function Result({ check }: { check: ServerCheckResult }) {
  const verdict = VERDICT[check.pqSupport];
  const leaf = check.chain[0];
  const checkedAt = new Date(check.checkedAt);
  const cbom = useMemo(
    () =>
      JSON.stringify(
        buildCbom(check.findings, {
          project: `${check.host}:${check.port}`,
          timestamp: check.checkedAt,
          serial: crypto.randomUUID(),
        }),
        null,
        2,
      ),
    [check],
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="default-radius space-y-2 border border-gray-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-semibold text-gray-900">
            {check.host}:{check.port}
          </span>
          <Badge variant={verdict.variant}>{verdict.label}</Badge>
        </div>
        <p className="text-sm text-gray-700">{verdict.text}</p>
        {leaf && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Certificate: </span>
            {quantumSafe(leaf.keyAlgorithm)
              ? `${leaf.keyAlgorithm}, a post-quantum signature.`
              : `${leaf.keyAlgorithm}, which a quantum computer could forge. This is less urgent than key exchange: forging needs a quantum computer at the time of the attack, so replace it once your certificate authority offers post-quantum certificates.`}
          </p>
        )}
        {!check.trusted && (
          <p className="text-sm text-red-700">Not trusted by browsers: {check.trustProblem}</p>
        )}
      </div>

      <dl className="default-radius space-y-1 border border-gray-100 bg-white p-4 text-sm">
        <Fact label="Address">{check.address}</Fact>
        <Fact label="Protocol">{check.protocol}</Fact>
        <Fact label="Key exchange">{check.keyExchange}</Fact>
        <Fact label="Cipher">{check.cipher}</Fact>
        <Fact label="Trusted">{check.trusted ? "Yes" : `No: ${check.trustProblem}`}</Fact>
        <Fact label="Checked">{checkedAt.toLocaleString()}</Fact>
      </dl>

      {check.chain.length > 0 && (
        <TableShell columns={["Certificate", "Key", "Signed with", "Expires"]}>
          {check.chain.map((c, i) => {
            const expired = new Date(c.notValidAfter) < checkedAt;
            return (
              <tr key={c.fingerprint}>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">
                  <span className="text-xs text-gray-400">{i === 0 ? "Server" : "Issuer"} · </span>
                  {c.subject || "(no subject)"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm whitespace-nowrap text-gray-700">{c.keyAlgorithm}</td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm whitespace-nowrap text-gray-700">{c.signatureAlgorithm}</td>
                <td className={`border-b border-gray-100 px-4 py-3 text-sm whitespace-nowrap ${expired ? "text-red-700" : "text-gray-700"}`}>
                  {new Date(c.notValidAfter).toLocaleDateString()}
                  {expired && " (expired)"}
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}

      <div className="flex justify-end">
        <DownloadButton
          label="CBOM (CycloneDX 1.6)"
          value={cbom}
          filename={`server-cbom-${check.host}-${check.checkedAt.slice(0, 10)}.cdx.json`}
          mimeType="application/json"
        />
      </div>
    </div>
  );
}

/** Checks a live server's key exchange and certificates. */
export default function ServerCheck() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(443);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServerCheckResult | null>(null);

  async function check() {
    if (!host.trim() || checking) return;
        setChecking(true);
    setError(null);
    try {
      const response = await runServerCheck(host, port);
      if (response.ok) setResult(response.data);
      else {
        setResult(null);
        setError(response.error);
      }
    } catch {
      setResult(null);
      setError("The check did not complete. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-12">
      <SectionPanel title="Check a server">
        <p className="mb-4 text-sm text-gray-600">
          Connects to a server the way a browser does and reports whether its key exchange is post-quantum, and which
          certificates it presents. Check servers your organization runs. Nothing is sent after the handshake.
        </p>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="example.com"
            aria-label="Hostname"
            autoComplete="off"
            spellCheck={false}
            className="default-radius flex-1 border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <select
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            aria-label="Port"
            className="default-radius cursor-pointer border border-gray-200 bg-white px-2 py-2 text-sm text-gray-800"
          >
            {PORTS.map((p) => (
              <option key={p} value={p}>
                Port {p}
              </option>
            ))}
          </select>
          <LRButton type="submit" disabled={!host.trim() || checking} icon={<MdLanguage className="text-lg" />}>
            {checking ? "Checking…" : "Check"}
          </LRButton>
        </form>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {result && <Result key={`${result.host}:${result.port}:${result.checkedAt}`} check={result} />}
      </SectionPanel>
    </div>
  );
}