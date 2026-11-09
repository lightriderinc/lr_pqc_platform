"use client";

import LRButton from "@/components/ui/LRButton";
import {
  attackEc,
  attackKem,
  checkMessage,
  runEcExchange,
  runKemExchange,
  type EcAttackResult,
  type EcRecording,
  type ExchangeResult,
  type KemAttackResult,
  type KemRecording,
} from "@/lib/pqc/harvest";
import {
  ATTACK_CHUNK_STEPS,
  MESSAGE,
  NEXT_STEP,
  REAL_X25519_BITS,
  TEST_CURVE,
  TEXT,
} from "@/lib/pqc/harvestConfig";
import { SearchCancelled, type SearchProgress } from "@/lib/pqc/toyCurve";
import { bytesToHex } from "@noble/hashes/utils.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MdCheck, MdLockOpen, MdShield } from "react-icons/md";
import ModalShell from "./ModalShell";

const num = (n: number) => n.toLocaleString("en-US");
const ms = (v: number) => (v < 1 ? v.toFixed(2) : v.toFixed(1));
const HEX_PREVIEW = 48;

interface Exchanges {
  message: string;
  ec: ExchangeResult<EcRecording>;
  kem: ExchangeResult<KemRecording>;
}

function Panel({
  title,
  subtitle,
  ex,
  children,
}: {
  title: string;
  subtitle: string;
  ex: ExchangeResult<EcRecording | KemRecording>;
  children?: React.ReactNode;
}) {
  const match = ex.aliceFingerprint === ex.bobFingerprint;
  return (
    <section className="default-radius flex flex-col gap-3 border border-gray-100 p-4">
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <ol className="space-y-1 text-xs text-gray-700">
        {ex.steps.map((s) => (
          <li key={s.label} className="flex justify-between gap-2">
            <span>{s.label}</span>
            <span className="shrink-0 font-mono text-gray-500">
              {ms(s.ms)} ms{s.sentBytes !== undefined && `, ${num(s.sentBytes)} B`}
            </span>
          </li>
        ))}
      </ol>

      <div className={`flex items-center gap-2 text-xs ${match ? "text-green-700" : "text-red-700"}`}>
        {match && <MdCheck />}
        <span>
          {TEXT.secretsMatch}: <span className="font-mono">{ex.aliceFingerprint}</span>
        </span>
      </div>

      <div className="default-radius space-y-1 bg-gray-50 p-2">
        <p className="text-2xs uppercase tracking-wide text-gray-500">{TEXT.recorded}</p>
        {ex.wire.map((w) => (
          <p key={w.label} className="break-all font-mono text-2xs text-gray-500">
            <span className="text-gray-700">{w.label}</span> ({num(w.bytes.length)} B){" "}
            {bytesToHex(w.bytes).slice(0, HEX_PREVIEW)}
            {w.bytes.length * 2 > HEX_PREVIEW && "…"}
          </p>
        ))}
      </div>

      {children}
    </section>
  );
}

export default function HarvestModal({ onClose }: { onClose: () => void }) {
  const cancelled = useRef(false);
  const [message, setMessage] = useState("");
  const [exchanges, setExchanges] = useState<Exchanges | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [ecResult, setEcResult] = useState<EcAttackResult | null>(null);
  const [kemResult, setKemResult] = useState<KemAttackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  function runExchange() {
    setError(null);
    setEcResult(null);
    setKemResult(null);
    setProgress(null);
    try {
      const m = checkMessage(message || MESSAGE.placeholder);
      setExchanges({ message: m, ec: runEcExchange(m), kem: runKemExchange(m) });
    } catch (e) {
      setExchanges(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function attack() {
    if (!exchanges) return;
    setError(null);
    setEcResult(null);
    setKemResult(attackKem(exchanges.kem.recording));
    setProgress({ steps: 0, maxSteps: 1 });
    try {
      const r = await attackEc(exchanges.ec.recording, ATTACK_CHUNK_STEPS, setProgress, () => cancelled.current);
      setEcResult(r);
    } catch (e) {
      if (!(e instanceof SearchCancelled)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  const attacking = progress !== null;
  const done = ecResult !== null && kemResult !== null;

  return (
    <ModalShell title="Harvest Now, Decrypt Later" onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-5 pt-4">
        <p className="text-sm text-gray-600">{TEXT.intro}</p>
        

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MESSAGE.maxChars}
            placeholder={MESSAGE.placeholder}
            aria-label={TEXT.messageLabel}
            className="w-full px-3 py-2 text-sm text-gray-800"
            autoComplete="off"
          />
          <LRButton type="button" onClick={runExchange} disabled={attacking} className="shrink-0">
            {exchanges ? TEXT.rerun : TEXT.run}
          </LRButton>
        </div>

        {error && (
          <p className="default-radius border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {exchanges && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title={TEXT.ecTitle} subtitle={TEXT.ecSubtitle(TEST_CURVE.bits)} ex={exchanges.ec}>
                {attacking && progress && (
                  <div className="space-y-1" role="status" aria-live="polite">
                    <div className="h-2 overflow-hidden bg-gray-100">
                      <div
                        className="h-2 bg-[var(--brand-primary)]"
                        style={{ width: `${Math.min(100, (progress.steps / progress.maxSteps) * 100)}%` }}
                      />
                    </div>
                    <p className="font-mono text-xs text-gray-600">
                      {TEXT.stepsOf(num(progress.steps), num(progress.maxSteps))}
                    </p>
                  </div>
                )}
                {ecResult && (
                  <div className="default-radius space-y-2 border border-red-100 bg-red-50 p-3">
                    {ecResult.decrypted !== null ? (
                      <>
                        <p className="flex items-center gap-2 font-semibold text-red-800">
                          <MdLockOpen /> {TEXT.broken}
                        </p>
                        <p className="text-xs text-red-900">
                          {TEXT.ecBrokenDetail(num(ecResult.steps), (ecResult.ms / 1000).toFixed(2))}
                        </p>
                        <div>
                          <p className="text-xs text-red-900">{TEXT.decryptedLabel}</p>
                          <p className="default-radius break-words bg-white px-2 py-1 font-mono text-xs text-gray-900">
                            {ecResult.decrypted}
                          </p>
                          {ecResult.decrypted === exchanges.message && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-red-900">
                              <MdCheck /> {TEXT.matchesMessage}
                            </p>
                          )}
                        </div>
                        <p className="text-2xs text-red-700">{TEXT.sizeNote(TEST_CURVE.bits, REAL_X25519_BITS)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-700">{TEXT.searchFailed}</p>
                    )}
                  </div>
                )}
              </Panel>

              <Panel title={TEXT.kemTitle} subtitle={TEXT.kemSubtitle} ex={exchanges.kem}>
                {kemResult && (
                  <div className="default-radius space-y-2 border border-green-100 bg-green-50 p-3">
                    <p className="flex items-center gap-2 font-semibold text-green-800">
                      <MdShield /> {TEXT.safe}
                    </p>
                    <p className="text-xs text-green-900">{TEXT.kemSafeDetail}</p>
                    <p className="text-xs text-green-900">
                      {TEXT.kemAttempt}: <span className="font-semibold">{kemResult.decrypted === null ? TEXT.kemRejected : kemResult.decrypted}</span>
                    </p>
                  </div>
                )}
              </Panel>
            </div>

            <LRButton type="button" onClick={attack} disabled={attacking} className="w-full">
              {attacking ? TEXT.attacking : TEXT.attack}
            </LRButton>

            {done && (
              <Link
                href={NEXT_STEP.href}
                className="block text-center text-sm text-[var(--brand-primary)] underline-offset-2 hover:underline"
              >
                {NEXT_STEP.label}
              </Link>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}