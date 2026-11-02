"use client";

import CopyButton from "@/components/ui/CopyButton";
import DownloadButton from "@/components/ui/DownloadButton";
import InfoBox from "@/components/ui/InfoBox";
import LRButton from "@/components/ui/LRButton";
import {
  checkShare,
  fingerprint,
  generateCustodianKey,
  parseKeyFile,
  parsePublicKey,
  parseShareFile,
  practiceCustodians,
  recoverSecret,
  recoveryChecklist,
  splitSecret,
  type CustodianKeyFile,
  type GeneratedCustodian,
  type ShareCheck,
  type ShareFile,
} from "@/lib/pqc/keySplit";
import { KEYSPLIT_LIMITS, PAD_BLOCK_BYTES, PRACTICE, TEXT } from "@/lib/pqc/keySplitConfig";
import { useRef, useState } from "react";
import { MdAdd, MdCheck, MdClose, MdUploadFile } from "react-icons/md";
import ModalShell from "./ModalShell";

type Tab = "keys" | "split" | "check" | "recover";
const TAB_ORDER: Tab[] = ["keys", "split", "check", "recover"];

const fieldClass = "w-full px-3 py-2 text-sm text-gray-800";
const textareaClass =
  "default-radius w-full resize-none border border-gray-100 px-3 py-2 font-mono text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300";

const slug = (text: string) => text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "secret";
const errorText = (e: unknown) => (e instanceof Error ? e.message : TEXT.errors.generic);

/** What practice mode has made, shared between tabs. */
interface Practice {
  custodians: GeneratedCustodian[];
  shares: ShareFile[] | null;
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="default-radius border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

/** Reads dropped or chosen files and sorts them into share files and key files. */
async function readFiles(files: FileList | File[]) {
  const shares: ShareFile[] = [];
  const keys: CustodianKeyFile[] = [];
  const errors: string[] = [];
  for (const file of Array.from(files)) {
    if (file.size > KEYSPLIT_LIMITS.maxFileBytes) {
      errors.push(TEXT.errors.fileTooLarge(file.name));
      continue;
    }
    const text = await file.text();
    try {
      shares.push(parseShareFile(text));
    } catch {
      try {
        keys.push(parseKeyFile(text));
      } catch (e) {
        errors.push(TEXT.errors.fileNamed(file.name, errorText(e)));
      }
    }
  }
  return { shares, keys, errors };
}

function DropZone({ onFiles, multiple }: { onFiles: (files: FileList) => void; multiple: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
        className="default-radius flex w-full cursor-pointer flex-col items-center gap-2 border border-dashed border-gray-200 bg-gray-50 px-6 py-6 text-center hover:border-gray-300 hover:bg-gray-100"
      >
        <MdUploadFile className="text-3xl text-gray-300" />
        <span className="text-sm font-medium text-gray-700">{TEXT.dropFiles}</span>
        {multiple && <span className="text-xs text-gray-400">{TEXT.dropHint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

/* ---------------- 1. custodian key ---------------- */

function KeysTab() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<GeneratedCustodian | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{TEXT.keysIntro}</p>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={TEXT.namePlaceholder} aria-label={TEXT.namePlaceholder} className={fieldClass} autoComplete="off" />
        <LRButton
          type="button"
          className="shrink-0"
          onClick={() => {
            setError(null);
            try {
              setResult(generateCustodianKey(name));
            } catch (e) {
              setError(errorText(e));
            }
          }}
        >
          {TEXT.createKey}
        </LRButton>
      </div>
      <ErrorLine message={error} />
      {result && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-500">{TEXT.fingerprint}</p>
            <p className="font-mono text-lg text-gray-900">{result.fingerprint}</p>
            <p className="text-xs text-gray-500">{TEXT.fingerprintHint}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-800">{TEXT.publicKeyTitle}</p>
              <CopyButton value={result.publicKeyText} className="text-xs" />
            </div>
            <textarea readOnly value={result.publicKeyText} rows={3} className={textareaClass} aria-label={TEXT.publicKeyTitle} />
          </div>
          <div className="default-radius space-y-2 border border-amber-100 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">{TEXT.privateKeyWarning}</p>
            <DownloadButton
              value={JSON.stringify(result.file, null, 2)}
              filename={`${slug(result.file.name)}-private-key.json`}
              mimeType="application/json"
              label={TEXT.downloadPrivateKey}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 2. split ---------------- */

interface Row {
  id: number;
  name: string;
  publicKeyText: string;
}

function rowFingerprint(text: string): string | null {
  try {
    return text.trim() ? fingerprint(parsePublicKey(text)) : null;
  } catch {
    return null;
  }
}

function SplitTab({ practice, onPractice, onPracticeShares }: {
  practice: Practice | null;
  onPractice: (p: Practice) => void;
  onPracticeShares: (s: ShareFile[]) => void;
}) {
  const nextId = useRef(3);
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: "", publicKeyText: "" },
    { id: 2, name: "", publicKeyText: "" },
  ]);
  const [threshold, setThreshold] = useState(KEYSPLIT_LIMITS.minCustodians);
  const [shares, setShares] = useState<ShareFile[] | null>(null);
  const [isPracticeSplit, setIsPracticeSplit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const k = Math.min(threshold, rows.length);
  const changed = () => setShares(null);

  function startPractice() {
    const custodians = practiceCustodians();
    onPractice({ custodians, shares: null });
    setRows(custodians.map((c, i) => ({ id: i + 1, name: c.file.name, publicKeyText: c.publicKeyText })));
    nextId.current = custodians.length + 1;
    setThreshold(PRACTICE.threshold);
    setLabel(PRACTICE.label);
    setShares(null);
    setError(null);
  }

  async function doSplit() {
    setError(null);
    setWorking(true);
    try {
      const result = await splitSecret({ label, secret, threshold: k, custodians: rows.map((r) => ({ name: r.name, publicKeyText: r.publicKeyText })) });
      const practiceKeys = new Set(practice?.custodians.map((c) => c.publicKeyText) ?? []);
      const allPractice = rows.length > 0 && rows.every((r) => practiceKeys.has(r.publicKeyText.trim()));
      setIsPracticeSplit(allPractice);
      if (allPractice) onPracticeShares(result);
      setShares(result);
      setSecret("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <LRButton type="button" variant="secondary-outline" onClick={startPractice}>
        {TEXT.practiceButton}
      </LRButton>
      {practice && (
        <p className="default-radius bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {TEXT.practiceBanner(practice.custodians.map((c) => c.file.name).join(", "))}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">{TEXT.labelTitle}</span>
        <input
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            changed();
          }}
          maxLength={KEYSPLIT_LIMITS.maxLabelChars}
          placeholder={TEXT.labelPlaceholder}
          className={fieldClass}
          autoComplete="off"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">{TEXT.secretTitle}</span>
        <textarea
          value={secret}
          onChange={(e) => {
            setSecret(e.target.value);
            changed();
          }}
          rows={3}
          className={textareaClass}
          autoComplete="off"
          spellCheck={false}
          aria-label={TEXT.secretTitle}
        />
        <span className="block text-xs text-gray-500">{TEXT.secretCleared}</span>
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-800">{TEXT.custodiansTitle}</p>
        {rows.map((row, i) => {
          const fp = rowFingerprint(row.publicKeyText);
          const update = (patch: Partial<Row>) => {
            setRows((r) => r.map((x) => (x.id === row.id ? { ...x, ...patch } : x)));
            changed();
          };
          return (
            <div key={row.id} className="default-radius space-y-2 border border-gray-100 p-3">
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 font-mono text-xs text-gray-400">{i + 1}</span>
                <input
                  value={row.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder={TEXT.custodianName}
                  aria-label={`${TEXT.custodianName} ${i + 1}`}
                  className={fieldClass}
                  autoComplete="off"
                />
                {rows.length > KEYSPLIT_LIMITS.minCustodians && (
                  <button
                    type="button"
                    onClick={() => {
                      setRows((r) => r.filter((x) => x.id !== row.id));
                      changed();
                    }}
                    aria-label={TEXT.removeCustodian(i + 1)}
                    className="shrink-0 cursor-pointer p-1 text-gray-400 hover:text-gray-700"
                  >
                    <MdClose />
                  </button>
                )}
              </div>
              <textarea
                value={row.publicKeyText}
                onChange={(e) => update({ publicKeyText: e.target.value })}
                placeholder={TEXT.publicKeyPlaceholder}
                rows={2}
                aria-label={`${TEXT.publicKeyTitle} ${i + 1}`}
                className={textareaClass}
                spellCheck={false}
              />
              {row.publicKeyText.trim() && (
                <p className={`text-xs ${fp ? "text-gray-600" : "text-red-600"}`}>
                  {fp ? TEXT.fingerprintConfirm(fp, row.name.trim() || TEXT.theCustodian) : TEXT.invalidPublicKey}
                </p>
              )}
            </div>
          );
        })}
        {rows.length < KEYSPLIT_LIMITS.maxCustodians && (
          <LRButton
            type="button"
            variant="secondary-outline"
            icon={<MdAdd />}
            onClick={() => {
              setRows((r) => [...r, { id: nextId.current++, name: "", publicKeyText: "" }]);
              changed();
            }}
          >
            {TEXT.addCustodian}
          </LRButton>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">{TEXT.thresholdTitle}</span>
        <select
          value={k}
          onChange={(e) => {
            setThreshold(Number(e.target.value));
            changed();
          }}
          className="default-radius block w-full cursor-pointer border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
        >
          {Array.from({ length: rows.length - 1 }, (_, i) => i + KEYSPLIT_LIMITS.minCustodians).map((n) => (
            <option key={n} value={n}>
              {TEXT.thresholdOption(n, rows.length)}
            </option>
          ))}
        </select>
        <span className="block text-xs text-gray-500">{TEXT.thresholdHint(PAD_BLOCK_BYTES)}</span>
      </label>

      <ErrorLine message={error} />
      <div className="flex justify-end">
        <LRButton type="button" onClick={doSplit} disabled={working}>
          {working ? TEXT.splitting : TEXT.splitButton}
        </LRButton>
      </div>

      {shares && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <p className="text-sm text-green-800">{TEXT.splitDone(shares[0].threshold, shares[0].total, shares[0].label)}</p>
          {isPracticeSplit && <p className="text-xs text-gray-600">{TEXT.practiceShares}</p>}
          <ul className="space-y-2">
            {shares.map((s) => (
              <li key={s.index} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800">
                  {s.index}. {s.custodian.name}
                </span>
                <DownloadButton
                  value={JSON.stringify(s, null, 2)}
                  filename={`${slug(s.label)}-share-${s.index}-${slug(s.custodian.name)}.json`}
                  mimeType="application/json"
                  label={TEXT.downloadShare}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------- 3. check a share ---------------- */

function CheckTab({ practice }: { practice: Practice | null }) {
  const [share, setShare] = useState<ShareFile | null>(null);
  const [key, setKey] = useState<CustodianKeyFile | null>(null);
  const [result, setResult] = useState<ShareCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  function check(s: ShareFile | null, k: CustodianKeyFile | null) {
    setShare(s);
    setKey(k);
    setResult(null);
    setError(null);
    if (!s || !k) return;
    try {
      setResult(checkShare(s, k));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function load(files: FileList) {
    const r = await readFiles(files);
    if (r.errors.length) {
      setError(r.errors.join(" "));
      return;
    }
    check(r.shares[0] ?? share, r.keys[0] ?? key);
  }

  const practiceShare = practice?.shares?.[0];
  const practiceKey = practice?.custodians[0]?.file;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{TEXT.checkIntro}</p>
      <DropZone onFiles={load} multiple />
      {practiceShare && practiceKey && (
        <LRButton type="button" variant="secondary-outline" onClick={() => check(practiceShare, practiceKey)}>
          {TEXT.usePractice}
        </LRButton>
      )}
      <ul className="space-y-1 text-sm">
        <li className={share ? "text-green-700" : "text-gray-500"}>
          {TEXT.slotShare}: {share ? `${share.custodian.name}, "${share.label}"` : TEXT.slotMissing}
        </li>
        <li className={key ? "text-green-700" : "text-gray-500"}>
          {TEXT.slotKey}: {key ? key.name : TEXT.slotMissing}
        </li>
      </ul>
      {(share === null) !== (key === null) && <p className="text-sm text-gray-500">{TEXT.errors.needOneOfEach}</p>}
      <ErrorLine message={error} />
      {result && (
        <p className="default-radius flex items-start gap-2 border border-green-100 bg-green-50 p-3 text-sm text-green-900" role="status">
          <MdCheck className="mt-0.5 shrink-0" /> {TEXT.checkOk(result.label, result.index, result.total, result.threshold)}
        </p>
      )}
    </div>
  );
}

/* ---------------- 4. recover ---------------- */

function RecoverTab({ practice }: { practice: Practice | null }) {
  const [shares, setShares] = useState<ShareFile[]>([]);
  const [keys, setKeys] = useState<CustodianKeyFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  function add(newShares: ShareFile[], newKeys: CustodianKeyFile[]) {
    setSecret(null);
    setShares((prev) => {
      const all = [...prev, ...newShares];
      return all.filter((s, i) => all.findIndex((x) => x.splitId === s.splitId && x.index === s.index) === i);
    });
    setKeys((prev) => {
      const all = [...prev, ...newKeys];
      return all.filter((k, i) => all.findIndex((x) => x.keyId === k.keyId) === i);
    });
  }

  async function load(files: FileList) {
    setError(null);
    const r = await readFiles(files);
    if (r.errors.length) setError(r.errors.join(" "));
    add(r.shares, r.keys);
  }

  async function recover() {
    setError(null);
    setWorking(true);
    try {
      setSecret(await recoverSecret(shares, keys));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(false);
    }
  }

  const list = recoveryChecklist(shares, keys);
  const practiceReady = practice?.shares && practice.custodians.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{TEXT.recoverIntro}</p>
      <DropZone onFiles={load} multiple />
      {practiceReady && (
        <LRButton
          type="button"
          variant="secondary-outline"
          onClick={() => add(practice.shares!.slice(0, PRACTICE.threshold), practice.custodians.slice(0, PRACTICE.threshold).map((c) => c.file))}
        >
          {TEXT.usePractice}
        </LRButton>
      )}

      {list.slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-800">{TEXT.checklistTitle(list.label, list.needed, list.total)}</p>
          <ul className="divide-y divide-gray-100 border border-gray-100">
            {list.slots.map((s) => (
              <li key={s.index} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className={s.name ? "text-gray-800" : "text-gray-400"}>
                  {s.index}. {s.name ?? TEXT.slotUnknown(s.index)}
                </span>
                <span className="flex gap-3 text-xs">
                  <span className={s.hasShare ? "text-green-700" : "text-gray-400"}>
                    {TEXT.slotShare}: {s.hasShare ? TEXT.slotReady : TEXT.slotMissing}
                  </span>
                  <span className={s.hasKey ? "text-green-700" : "text-gray-400"}>
                    {TEXT.slotKey}: {s.hasKey ? TEXT.slotReady : TEXT.slotMissing}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className={`text-sm ${list.ready ? "text-green-800" : "text-gray-600"}`}>
            {list.ready ? TEXT.readyText(list.usable, list.needed) : TEXT.notReadyText(list.usable, list.needed)}
          </p>
        </div>
      )}
      {list.problem && shares.length > 0 && <ErrorLine message={list.problem} />}
      <ErrorLine message={error} />

      <div className="flex justify-between gap-2">
        <LRButton
          type="button"
          variant="secondary-outline"
          onClick={() => {
            setShares([]);
            setKeys([]);
            setSecret(null);
            setError(null);
          }}
        >
          {TEXT.clear}
        </LRButton>
        <LRButton type="button" onClick={recover} disabled={!list.ready || working}>
          {working ? TEXT.recovering : TEXT.recoverButton}
        </LRButton>
      </div>

      {secret !== null && (
        <div className="default-radius space-y-2 border border-green-100 bg-green-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-green-900">{TEXT.recoveredTitle}</p>
            <CopyButton value={secret} className="text-xs" />
          </div>
          <textarea readOnly value={secret} rows={3} className={textareaClass} aria-label={TEXT.recoveredTitle} />
          <p className="text-xs text-green-900">{TEXT.recoveredHint}</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- modal ---------------- */

export default function KeySplitModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("keys");
  const [practice, setPractice] = useState<Practice | null>(null);

  return (
    <ModalShell title={TEXT.title} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-5 pt-4">
        <p className="text-sm text-gray-600">{TEXT.intro}</p>
        <InfoBox>{TEXT.privacy}</InfoBox>

        <div className="flex gap-1 overflow-x-auto border-b border-gray-100">
          {TAB_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={[
                "-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {TEXT.tabs[t]}
            </button>
          ))}
        </div>

        <div className={tab === "keys" ? "" : "hidden"}>
          <KeysTab />
        </div>
        <div className={tab === "split" ? "" : "hidden"}>
          <SplitTab
            practice={practice}
            onPractice={setPractice}
            onPracticeShares={(shares) => setPractice((p) => (p ? { ...p, shares } : p))}
          />
        </div>
        <div className={tab === "check" ? "" : "hidden"}>
          <CheckTab practice={practice} />
        </div>
        <div className={tab === "recover" ? "" : "hidden"}>
          <RecoverTab practice={practice} />
        </div>
      </div>
    </ModalShell>
  );
}