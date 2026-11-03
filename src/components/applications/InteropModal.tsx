"use client";

import CopyButton from "@/components/ui/CopyButton";
import LRButton from "@/components/ui/LRButton";
import {
  checkDecaps,
  checkEncaps,
  checkSign,
  checkVerify,
  keyRequest,
  newDecapsChallenge,
  newEncapsChallenge,
  newSignChallenge,
  newVerifyChallenge,
  type CheckResult,
  type DecapsChallenge,
} from "@/lib/pqc/interop";
import { DEFAULT_DSA, DEFAULT_KEM, DSA_SETS, KEM_SETS, TEXT, type DsaSet, type KemSet } from "@/lib/pqc/interopConfig";
import {
  answerDecaps,
  answerEncaps,
  answerKeyRequest,
  answerSign,
  answerVerify,
  responderVersion,
} from "@/lib/pqc/oqsResponder";
import { useEffect, useState } from "react";
import { MdCancel, MdCheckCircle } from "react-icons/md";
import ModalShell from "./ModalShell";

type Family = "kem" | "dsa";

const textareaClass =
  "default-radius w-full resize-y border border-gray-100 px-3 py-2 font-mono text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300";

function ChallengeBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <CopyButton value={text} className="text-xs" />
      </div>
      <textarea readOnly value={text} rows={5} className={textareaClass} aria-label={label} spellCheck={false} />
    </div>
  );
}

function ResultLine({ result }: { result: CheckResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`default-radius flex items-start gap-2 border p-3 text-sm ${
        result.ok ? "border-green-100 bg-green-50 text-green-900" : "border-red-100 bg-red-50 text-red-900"
      }`}
    >
      {result.ok ? <MdCheckCircle className="mt-0.5 shrink-0" /> : <MdCancel className="mt-0.5 shrink-0" />}
      <span>
        <span className="font-semibold">{result.ok ? TEXT.pass : TEXT.fail}.</span> {result.detail}
      </span>
    </p>
  );
}

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : TEXT.errors.responderFailed);

/** Runs liboqs on the published challenge and shows which implementation answered. */
function AnswerButton({ run, version }: { run: () => Promise<void>; version: string | null }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <LRButton
        type="button"
        variant="secondary-outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          try {
            await run();
            setNote(TEXT.answeredBy(version ?? ""));
          } catch (e) {
            setNote(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? TEXT.answering : TEXT.answerWith}
      </LRButton>
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </div>
  );
}

/** A check with one challenge, one response box, and a result. */
function SimpleCheck<C extends { text: string }>({
  title,
  how,
  make,
  check,
  answer,
  version,
}: {
  title: string;
  how: string;
  make: () => C;
  check: (challenge: C, response: string) => CheckResult;
  answer: (challengeText: string) => Promise<string>;
  version: string | null;
}) {
  const [challenge, setChallenge] = useState(make);
  const [response, setResponse] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);

  return (
    <section className="default-radius space-y-3 border border-gray-100 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{how}</p>
      </div>
      <ChallengeBox label={TEXT.challenge} text={challenge.text} />
      <AnswerButton
        key={challenge.text}
        version={version}
        run={async () => {
          setResponse(await answer(challenge.text));
          setResult(null);
        }}
      />
      <textarea
        value={response}
        onChange={(e) => {
          setResponse(e.target.value);
          setResult(null);
        }}
        rows={4}
        placeholder={TEXT.responsePlaceholder}
        aria-label={`${title}: ${TEXT.response}`}
        className={textareaClass}
        spellCheck={false}
      />
      <ResultLine result={result} />
      <div className="flex flex-wrap justify-between gap-2">
        <LRButton
          type="button"
          variant="secondary-outline"
          onClick={() => {
            setChallenge(make());
            setResponse("");
            setResult(null);
          }}
        >
          {TEXT.newChallenge}
        </LRButton>
        <LRButton type="button" onClick={() => setResult(check(challenge, response))}>
          {TEXT.check}
        </LRButton>
      </div>
    </section>
  );
}

/** Check 2 needs the user's public key first, so it has two steps. */
function DecapsCheck({ alg, version }: { alg: KemSet; version: string | null }) {
  const [keyResponse, setKeyResponse] = useState("");
  /** Held only when liboqs answered the key request, as a client keeps its own key. */
  const [oqsSecretKey, setOqsSecretKey] = useState<Uint8Array | null>(null);
  const [challenge, setChallenge] = useState<DecapsChallenge | null>(null);
  const [response, setResponse] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);

  function create() {
    setResult(null);
    setResponse("");
    try {
      setChallenge(newDecapsChallenge(alg, keyResponse));
    } catch (e) {
      setChallenge(null);
      setResult({ ok: false, detail: e instanceof Error ? e.message : TEXT.errors.generic });
    }
  }

  return (
    <section className="default-radius space-y-3 border border-gray-100 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{TEXT.decaps.title}</h3>
        <p className="text-sm text-gray-600">{TEXT.decaps.how}</p>
      </div>
      <ChallengeBox label={TEXT.decaps.keyRequest} text={keyRequest(alg)} />
      <AnswerButton
        version={version}
        run={async () => {
          const r = await answerKeyRequest(keyRequest(alg));
          setKeyResponse(r.response);
          setOqsSecretKey(r.secretKey);
          setChallenge(null);
          setResult(null);
        }}
      />
      <textarea
        value={keyResponse}
        onChange={(e) => {
          setKeyResponse(e.target.value);
          setOqsSecretKey(null);
        }}
        rows={3}
        placeholder={TEXT.responsePlaceholder}
        aria-label={TEXT.decaps.yourKey}
        className={textareaClass}
        spellCheck={false}
      />
      <div className="flex justify-end">
        <LRButton type="button" variant="secondary-outline" onClick={create}>
          {TEXT.decaps.makeCiphertext}
        </LRButton>
      </div>
      {challenge && (
        <>
          <ChallengeBox label={TEXT.challenge} text={challenge.text} />
          <AnswerButton
            key={challenge.text}
            version={version}
            run={async () => {
              if (!oqsSecretKey) throw new Error(TEXT.errors.noSavedKey);
              setResponse(await answerDecaps(challenge.text, oqsSecretKey));
              setResult(null);
            }}
          />
          <textarea
            value={response}
            onChange={(e) => {
              setResponse(e.target.value);
              setResult(null);
            }}
            rows={3}
            placeholder={TEXT.responsePlaceholder}
            aria-label={`${TEXT.decaps.title}: ${TEXT.response}`}
            className={textareaClass}
            spellCheck={false}
          />
          <div className="flex justify-end">
            <LRButton type="button" onClick={() => setResult(checkDecaps(challenge, response))}>
              {TEXT.check}
            </LRButton>
          </div>
        </>
      )}
      <ResultLine result={result} />
    </section>
  );
}

export default function InteropModal({ onClose }: { onClose: () => void }) {
  const [family, setFamily] = useState<Family>("kem");
  const [kem, setKem] = useState<KemSet>(DEFAULT_KEM);
  const [dsa, setDsa] = useState<DsaSet>(DEFAULT_DSA);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    responderVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  const sets: readonly string[] = family === "kem" ? KEM_SETS : DSA_SETS;

  return (
    <ModalShell title={TEXT.title} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-5 pt-4">
        <p className="text-sm text-gray-600">{TEXT.intro}</p>

        <div className="flex flex-wrap items-center gap-3">
          {(["kem", "dsa"] as Family[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamily(f)}
              aria-pressed={family === f}
              className={[
                "default-radius cursor-pointer border px-3 py-1.5 text-sm font-medium",
                family === f ? "border-[var(--brand-primary)] text-[var(--brand-primary)]" : "border-gray-100 text-gray-600 hover:border-gray-300",
              ].join(" ")}
            >
              {TEXT.families[f]}
            </button>
          ))}
          <select
            value={family === "kem" ? kem : dsa}
            onChange={(e) => (family === "kem" ? setKem(e.target.value as KemSet) : setDsa(e.target.value as DsaSet))}
            aria-label={TEXT.parameterSet}
            className="default-radius cursor-pointer border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
          >
            {sets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {family === "kem" ? (
          <div key={kem} className="space-y-4">
            <SimpleCheck title={TEXT.encaps.title} how={TEXT.encaps.how} make={() => newEncapsChallenge(kem)} check={checkEncaps} answer={answerEncaps} version={version} />
            <DecapsCheck alg={kem} version={version} />
          </div>
        ) : (
          <div key={dsa} className="space-y-4">
            <SimpleCheck title={TEXT.sign.title} how={TEXT.sign.how} make={() => newSignChallenge(dsa)} check={checkSign} answer={answerSign} version={version} />
            <SimpleCheck title={TEXT.verify.title} how={TEXT.verify.how} make={() => newVerifyChallenge(dsa)} check={checkVerify} answer={answerVerify} version={version} />
          </div>
        )}

        <p className="text-xs text-gray-500">{TEXT.footer}</p>
      </div>
    </ModalShell>
  );
}