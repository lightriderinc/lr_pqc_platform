"use client";

import Badge from "@/components/ui/Badge";
import CopyButton from "@/components/ui/CopyButton";
import LRButton from "@/components/ui/LRButton";
import { SAMPLE, SIGNATURE_RISK_NOTE, STATUS_DISPLAY, TEXT, type SampleAlgorithm } from "@/lib/pqc/jwtConfig";
import {
  algorithmInfo,
  cookieFit,
  decodeToken,
  expiryStatus,
  makeSampleToken,
  mlDsaVersions,
  sizeChecks,
  timeClaims,
  verifyToken,
  type Decoded,
  type ExpiryState,
  type MlDsaVersion,
  type SampleToken,
  type SizeCheck,
  type VerifyResult,
} from "@/lib/pqc/jwtInspect";
import { useMemo, useState } from "react";
import ModalShell from "./ModalShell";

const textareaClass =
  "default-radius w-full resize-y border border-gray-100 px-3 py-2 font-mono text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300";

const errorText = (e: unknown) => (e instanceof Error ? e.message : TEXT.errors.generic);

const EXPIRY_STYLE: Record<ExpiryState, string> = {
  valid: "text-green-700",
  expired: "text-red-700",
  notYet: "text-amber-700",
  none: "text-gray-500",
};

function Json({ value }: { value: unknown }) {
  return (
    <pre className="default-radius max-h-64 overflow-auto border border-gray-100 bg-gray-50 p-3 font-mono text-xs text-gray-800">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function SizeList({ checks }: { checks: SizeCheck[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {checks.map((c) => (
        <li key={c.id} className={c.fits ? "text-gray-700" : "text-red-700"}>
          {c.label}: {c.fits ? TEXT.fits(-c.overBy) : TEXT.tooLarge(c.overBy, c.consequence)}{" "}
          <span className="text-xs text-gray-400">({c.source})</span>
        </li>
      ))}
    </ul>
  );
}
function ErrorLine({ message }: { message: string }) {
  return (
    <p className="default-radius border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </section>
  );
}

function Details({ decoded, initialKey, now }: { decoded: Decoded; initialKey: string; now: number }) {
  const [keyText, setKeyText] = useState(initialKey);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [versions, setVersions] = useState<MlDsaVersion[] | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [pqError, setPqError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const info = algorithmInfo(decoded);
  const status = STATUS_DISPLAY[info.status];
  const signed = decoded.kind === "signed";
  const expiry = signed ? expiryStatus(decoded.payload, now) : null;
  const isHmac = decoded.alg.startsWith("HS");

    /** Runs a task and shows any error next to the button that started it. */
  async function run(task: () => Promise<void>, setError: (m: string | null) => void) {
    setError(null);
    setWorking(true);
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(false);
    }
  }

  const fit = versions ? cookieFit(versions) : null;

  return (
    <div className="space-y-4">
      {/* Verdict first */}
      <div className="default-radius space-y-2 border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-2xl font-semibold text-gray-900">{decoded.alg || TEXT.noAlg}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-sm text-gray-500">{info.family}</p>
        <p className="text-sm text-gray-800">{info.note}</p>
        {signed && info.status === "broken" && <p className="text-sm text-gray-600">{SIGNATURE_RISK_NOTE}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {expiry && <span className={EXPIRY_STYLE[expiry.state]}>{expiry.text}</span>}
          <span className="text-gray-500">{TEXT.size(decoded.token.length)}</span>
        </div>
      </div>

      {!signed && <p className="text-sm text-gray-600">{TEXT.encrypted}</p>}

      {signed && decoded.alg !== "none" && (
        <Section title={TEXT.verifyTitle}>
          <textarea
            value={keyText}
            onChange={(e) => {
              setKeyText(e.target.value);
              setVerify(null);
            }}
            rows={4}
            placeholder={isHmac ? TEXT.secretPlaceholder : TEXT.keyPlaceholder}
            className={textareaClass}
            spellCheck={false}
            aria-label={TEXT.verifyTitle}
          />
          {isHmac && <p className="text-xs text-amber-700">{TEXT.secretWarning}</p>}
          <div className="flex items-center justify-between gap-3">
            {verify ? (
              <p className={`text-sm ${verify.valid ? "text-green-700" : "text-red-700"}`} role="status">
                {verify.valid ? TEXT.valid : verify.reason}
              </p>
            ) : (
              <span />
            )}
            <LRButton
              type="button"
              variant="secondary-outline"
              disabled={working}
              onClick={() => run(async () => setVerify(await verifyToken(decoded, keyText)), setVerifyError)}
            >
              {TEXT.verifyButton}
            </LRButton>
          </div>
          {verifyError && <ErrorLine message={verifyError} />}
        </Section>
      )}

      {signed && (
        <Section title={TEXT.pqTitle}>
          <p className="text-sm text-gray-600">{TEXT.pqIntro}</p>
          {!versions && (
            <LRButton type="button" disabled={working}onClick={() => run(async () => setVersions(await mlDsaVersions(decoded)), setPqError)}>
                        {pqError && <ErrorLine message={pqError} />}
              {working ? TEXT.pqWorking : TEXT.pqButton}
            </LRButton>
          )}
          {fit && <p className="text-sm font-medium text-gray-800">{TEXT.cookieAdvice(fit.fit, fit.noFit)}</p>}
          {versions?.map((v) => (
            <div key={v.alg} className="default-radius space-y-2 border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">
                  {v.alg}: {TEXT.size(v.token.length)}, {v.verified ? TEXT.pqVerified : TEXT.pqFailed}
                </p>
                <div className="flex gap-2">
                  <CopyButton value={v.token} className="text-xs" label={TEXT.copyToken} />
                  <CopyButton value={v.publicJwk} className="text-xs" label={TEXT.copyKey} />
                </div>
              </div>
              <SizeList checks={v.sizes} />
            </div>
          ))}
        </Section>
      )}

      <details className="border-t border-gray-100 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">{TEXT.details}</summary>
        <div className="space-y-4 pt-3">
          {signed && timeClaims(decoded.payload).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{TEXT.dates}</p>
              <ul className="space-y-1 text-sm text-gray-700">
                {timeClaims(decoded.payload).map((c) => (
                  <li key={c.label}>
                    {c.label}: {c.date.toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{TEXT.header}</p>
            <Json value={decoded.header} />
          </div>
          {signed && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{TEXT.payload}</p>
              <Json value={decoded.payload} />
            </div>
          )}
          {signed && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{TEXT.sizeChecks}</p>
              <SizeList checks={sizeChecks(decoded.token)} />
            </div>
          )}
        </div>
      </details>

    </div>
  );
}

export default function JwtInspectorModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [sampleAlg, setSampleAlg] = useState<SampleAlgorithm>(SAMPLE.defaultAlgorithm as SampleAlgorithm);
  const [sample, setSample] = useState<SampleToken | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { decoded: decodeToken(input) };
    } catch (e) {
      return { error: errorText(e) };
    }
  }, [input]);

  async function makeSample() {
    setSampleError(null);
    try {
      const at = Date.now();
      const s = await makeSampleToken(sampleAlg, at);
      setSample(s);
      setNow(at);
      setInput(s.token);
    } catch (e) {
      setSampleError(errorText(e));
    }
  }

  const decoded = result && "decoded" in result ? result.decoded : null;
  const isSample = sample !== null && decoded?.token === sample.token;

  return (
    <ModalShell title={TEXT.title} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4 pt-4">
        <p className="text-sm text-gray-600">{TEXT.intro}</p>
        
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setNow(Date.now());
          }}
          rows={5}
          placeholder={TEXT.tokenPlaceholder}
          className={textareaClass}
          spellCheck={false}
          autoComplete="off"
          aria-label={TEXT.tokenLabel}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sampleAlg}
            onChange={(e) => setSampleAlg(e.target.value as SampleAlgorithm)}
            aria-label={TEXT.sampleButton}
            className="default-radius cursor-pointer border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
          >
            {SAMPLE.algorithms.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <LRButton type="button" variant="secondary-outline" onClick={makeSample}>
            {TEXT.sampleButton}
          </LRButton>
        </div>
        {sampleError && <p className="text-sm text-red-700">{sampleError}</p>}
        {isSample && <p className="default-radius bg-gray-50 px-3 py-2 text-xs text-gray-600">{TEXT.sampleBanner}</p>}

        {result && "error" in result && (
          <p className="text-sm text-red-700" role="alert">
            {result.error}
          </p>
        )}
        {decoded && now !== null && (
          <Details key={decoded.token} decoded={decoded} initialKey={isSample ? sample.keyText : ""} now={now} />
        )}
      </div>
    </ModalShell>
  );
}