"use client";

import { runDomainAudit } from "@/app/qsearch/actions";
import Badge from "@/components/ui/Badge";
import LRButton from "@/components/ui/LRButton";
import SectionPanel from "@/components/ui/SectionPanel";
import TableShell from "@/components/ui/TableShell";
import { auditFindings } from "@/lib/qsearch/auditFindings";
import type { Challenge, DomainAudit as Audit, HostResult } from "@/lib/qsearch/domainAudit";
import type { SignedResult } from "@/lib/qsearch/attestation";
import DownloadButton from "@/components/ui/DownloadButton";
import { useMemo, useState } from "react";
import { MdPublic } from "react-icons/md";
import FixPlan from "./FixPlan";

const cell = "border-b border-gray-100 px-4 py-3 text-sm text-gray-700";

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr_auto] sm:items-center">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <code className="break-all rounded bg-white px-2 py-1 text-xs text-gray-800">{value}</code>
      <button
        type="button"
        className="text-xs font-medium text-gray-700 hover:underline"
        onClick={() =>
          navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => { },
          )
        }
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function KeyExchange({ host }: { host: HostResult }) {
  if (!host.check) return <span className="text-gray-500">{host.error}</span>;
  const { pqSupport, keyExchange } = host.check;
  const variant = pqSupport === "default" ? "ready" : pqSupport === "available" ? "warn" : "vulnerable";
  const label =
    pqSupport === "default" ? "Post-quantum" : pqSupport === "available" ? "Supported, not chosen" : "Classical only";
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant={variant}>{label}</Badge>
      <span className="text-xs text-gray-500">{keyExchange}</span>
    </span>
  );
}

function Result({
  audit,
  challenge,
  signed,
}: {
  audit: Audit;
  challenge: Challenge | null;
  signed: SignedResult<Audit> | null;
}) {
  const s = audit.summary;
  const at = useMemo(() => new Date(audit.checkedAt), [audit.checkedAt]);
  const findings = useMemo(() => auditFindings(audit), [audit]);
  return (
    <div className="mt-4 space-y-6">
      <div className="default-radius space-y-2 border border-gray-100 bg-white p-4 text-sm text-gray-700">
        <p className="font-mono text-lg font-semibold text-gray-900">{audit.domain}</p>
        <p>
          {s.hostsFound} public {s.hostsFound === 1 ? "host" : "hosts"} found, {s.hostsChecked} checked:{" "}
          <span className="font-medium text-green-700">{s.postQuantum} post-quantum</span>
          {s.postQuantumNotChosen > 0 && <>, {s.postQuantumNotChosen} supported but not chosen</>},{" "}
          <span className="font-medium text-red-700">{s.classical} classical only</span>
          {s.unreachable > 0 && <>, {s.unreachable} not checked</>}.
        </p>
        <p>
          Email signing (DKIM): {s.dkimKeys} {s.dkimKeys === 1 ? "key" : "keys"} found. DNSSEC: {s.dnssec ? "signed" : "not signed"}.
        </p>
        {audit.notes.map((n) => (
          <p key={n} className="text-xs text-gray-500">
            {n}
          </p>
        ))}
      </div>

      {!audit.verified && (
        <div className="default-radius space-y-3 border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800">
          <p>
            <span className="font-medium">Verify that you own {audit.domain}</span> to see each host, its key exchange
            and certificate, the email and DNS keys, and a fix plan. Until then only these counts are shown, so the
            audit cannot be used to map someone else&apos;s systems.
          </p>
          {challenge ? (
            <>
              <p>Add this DNS TXT record at your DNS provider, then run the audit again:</p>
              <Copyable label="Name" value={challenge.name} />
              <Copyable label="Value" value={challenge.value} />
              <p className="text-xs text-gray-500">
                DNS changes can take a few minutes to appear. The record also covers every subdomain. It proves
                ownership for your account only, and can be removed once you are done.
              </p>
            </>
          ) : (
            <p>Domain verification is not set up on this server.</p>
          )}
        </div>
      )}

      {audit.verified && audit.hosts && (
        <TableShell columns={["Host", "Key exchange", "Certificate", "Expires"]}>
          {audit.hosts.map((h) => {
            const leaf = h.check?.chain[0];
            const expired = leaf ? new Date(leaf.notValidAfter) < at : false;
            return (
              <tr key={h.host}>
                <td className={`${cell} font-mono text-xs`}>{h.host}</td>
                <td className={cell}>
                  <KeyExchange host={h} />
                </td>
                <td className={cell}>{leaf?.keyAlgorithm ?? "—"}</td>
                <td className={`${cell} whitespace-nowrap ${expired ? "text-red-700" : ""}`}>
                  {leaf?.notValidAfter ? new Date(leaf.notValidAfter).toLocaleDateString() : leaf ? "Unreadable" : "—"}
                  {expired && " (expired)"}
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}

      {audit.verified && (
        <div className="default-radius space-y-1 border border-gray-100 bg-white p-4 text-sm text-gray-700">
          <p className="font-medium">Email signing (DKIM)</p>
          {audit.dkim && audit.dkim.length > 0 ? (
            audit.dkim.map((k) => (
              <p key={k.selector}>
                <span className="font-mono text-xs">{k.selector}._domainkey</span>: {k.algorithm}
              </p>
            ))
          ) : (
            <p className="text-gray-500">
              No DKIM keys found under common selectors. Your mail provider can tell you the selector it uses.
            </p>
          )}
          <p className="pt-2 font-medium">DNSSEC</p>
          {audit.dnssec?.signed ? (
            <p>
              Signed with{" "}
              {audit.dnssec.keys.map((k) => (k.bits ? `${k.algorithm} (${k.bits} bits)` : k.algorithm)).join(", ")}
            </p>
          ) : (
            <p className="text-gray-500">The zone is not signed with DNSSEC.</p>
          )}
        </div>
      )}

      {audit.verified && <FixPlan findings={findings} at={at} />}

      {signed && (
        <div className="flex justify-end">
          <DownloadButton
            label="Signed audit (JSON)"
            value={JSON.stringify(signed, null, 2)}
            filename={`domain-audit-signed-${audit.domain}-${audit.checkedAt.slice(0, 10)}.json`}
            mimeType="application/json"
          />
        </div>
      )}
    </div>
  );
}

/** A domain's public cryptography, seen from outside: hosts, email signing and DNSSEC. */
export default function DomainAudit() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    audit: Audit;
    challenge: Challenge | null;
    signed: SignedResult<Audit> | null;
  } | null>(null);

  async function audit() {
    if (!domain.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await runDomainAudit(domain);
      if (r.ok) setResult(r.data);
      else {
        setResult(null);
        setError(r.error);
      }
    } catch {
      setResult(null);
      setError("The audit did not complete. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12">
      <SectionPanel title="Audit a domain">
        <p className="mb-4 text-sm text-gray-600">
          Finds a domain&apos;s public hosts in certificate transparency logs and checks each one&apos;s key exchange and
          certificate, then its email signing (DKIM) and DNSSEC keys. Nothing is sent to the hosts after the handshake.
        </p>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            audit();
          }}
        >
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            aria-label="Domain"
            autoComplete="off"
            spellCheck={false}
            maxLength={260}
            className="default-radius flex-1 border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <LRButton type="submit" disabled={!domain.trim() || busy} icon={<MdPublic className="text-lg" />}>
            {busy ? "Auditing… up to a minute" : "Audit"}
          </LRButton>
        </form>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {result && (
          <Result
            key={`${result.audit.domain}:${result.audit.checkedAt}`}
            audit={result.audit}
            challenge={result.challenge}
            signed={result.signed}
          />
        )}
      </SectionPanel>
    </div>
  );
}