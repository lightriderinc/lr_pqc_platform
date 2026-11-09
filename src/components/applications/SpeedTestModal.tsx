"use client";

import CopyButton from "@/components/ui/CopyButton";
import DownloadButton from "@/components/ui/DownloadButton";
import LRButton from "@/components/ui/LRButton";
import {
  SpeedTestCancelled,
  clearHistory,
  compare,
  deviceSummary,
  diffRuns,
  loadHistory,
  ratioText,
  runSpeedTest,
  saveHistory,
  type AlgorithmResult,
  type Measurement,
  type Progress,
  type RunRecord,
  type Verdict,
} from "@/lib/pqc/speedTest";
import {
  ALGORITHMS,
  FAMILY_TITLES,
  HEADLINES,
  OPERATIONS,
  SIZE_LABELS,
  TEXT,
  type Family,
} from "@/lib/pqc/speedTestConfig";
import { useEffect, useRef, useState } from "react";
import ModalShell from "./ModalShell";

const FAMILIES: Family[] = ["kem", "sig"];
const DEFAULT_IDS = ALGORITHMS.filter((a) => a.selectedByDefault).map((a) => a.id);

const fmtMs = (v: number) => (v < 1 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0));
const fmtNum = (n: number) => n.toLocaleString("en-US");
const pct = (f: number) => `${Math.round(f * 100)}%`;

const VERDICT_STYLE: Record<Verdict, string> = {
  faster: "text-green-700",
  slower: "text-red-700",
  same: "text-gray-500",
};
const VERDICT_TEXT: Record<Verdict, string> = {
  faster: TEXT.verdictFaster,
  slower: TEXT.verdictSlower,
  same: TEXT.verdictSame,
};

function Cell({ m }: { m: Measurement }) {
  return (
    <td className="px-3 py-2 text-right font-mono">
      {fmtMs(m.ms)}
      <span className="ml-1 text-2xs text-gray-400">±{pct(m.noise)}</span>
    </td>
  );
}

function ResultTable({ family, results }: { family: Family; results: AlgorithmResult[] }) {
  const rows = results.filter((r) => r.family === family);
  if (rows.length === 0) return null;
  const sizes = SIZE_LABELS[family];
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">{FAMILY_TITLES[family]}</h3>
      <div className="default-radius overflow-x-auto border border-gray-100">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-medium">{TEXT.algorithmColumn}</th>
              {OPERATIONS[family].map((op) => (
                <th key={op.id} className="px-3 py-2 text-right font-medium">
                  {TEXT.msUnit(op.label)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">{TEXT.bytesUnit(sizes.publicKey)}</th>
              <th className="px-3 py-2 text-right font-medium">{TEXT.bytesUnit(sizes.output)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <span className={r.kind === "pqc" ? "font-medium text-gray-900" : "text-gray-500"}>{r.label}</span>
                  <span className="ml-2 text-2xs uppercase tracking-wide text-gray-400">
                    {r.kind === "pqc" ? r.standard : TEXT.today}
                  </span>
                </td>
                {OPERATIONS[family].map((op) => (
                  <Cell key={op.id} m={r.ops[op.id]} />
                ))}
                <td className="px-3 py-2 text-right font-mono">{fmtNum(r.sizes.publicKey)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtNum(r.sizes.output)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Headlines({ results }: { results: AlgorithmResult[] }) {
  const cards = HEADLINES.map((h) => {
    const c = compare(results, h.pqc, h.classical);
    const p = results.find((r) => r.id === h.pqc);
    const k = results.find((r) => r.id === h.classical);
    return c && p && k ? { h, c, p, k } : null;
  }).filter((x) => x !== null);
  if (cards.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map(({ h, c, p, k }) => (
        <div key={h.title} className="default-radius space-y-1 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">{h.title}</p>
          <p className="text-2xl font-semibold text-gray-900">{ratioText(c.speedRatio)}</p>
          <p className="text-sm text-gray-600">
            {TEXT.headlineDetail(p.label, k.label, fmtMs(c.pqcTotal), fmtMs(c.classicalTotal), c.sizeRatio.toFixed(0))}
          </p>
        </div>
      ))}
    </div>
  );
}

function History({ runs, onClear }: { runs: RunRecord[]; onClear: () => void }) {
  const [beforeIdx, setBeforeIdx] = useState(Math.max(0, runs.length - 2));
  const [afterIdx, setAfterIdx] = useState(runs.length - 1);
  const label = (r: RunRecord, i: number) =>
    TEXT.runName(i + 1, new Date(r.at).toLocaleTimeString(), r.results.length);

  const before = runs[Math.min(beforeIdx, runs.length - 1)];
  const after = runs[Math.min(afterIdx, runs.length - 1)];
  const diffs = before && after ? diffRuns(before.results, after.results) : [];
  const opLabel = (family: Family, op: string) => OPERATIONS[family].find((o) => o.id === op)?.label ?? op;
  const familyOf = (id: string) => ALGORITHMS.find((a) => a.id === id)?.family ?? "kem";

  return (
    <section className="space-y-3 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">{TEXT.history}</h3>
        <button type="button" onClick={onClear} className="cursor-pointer text-xs text-gray-500 hover:text-gray-800">
          {TEXT.clearHistory}
        </button>
      </div>
      <p className="text-xs text-gray-500">{TEXT.historyHint}</p>
      {runs.length >= 2 && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { title: TEXT.before, idx: beforeIdx, set: setBeforeIdx },
              { title: TEXT.after, idx: afterIdx, set: setAfterIdx },
            ].map((s) => (
              <label key={s.title} className="space-y-1 text-xs text-gray-600">
                <span>{s.title}</span>
                <select
                  value={Math.min(s.idx, runs.length - 1)}
                  onChange={(e) => s.set(Number(e.target.value))}
                  className="default-radius block w-full cursor-pointer border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
                >
                  {runs.map((r, i) => (
                    <option key={r.id} value={i}>
                      {label(r, i)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {diffs.length === 0 ? (
            <p className="text-sm text-gray-500">{TEXT.noOverlap}</p>
          ) : (
            <div className="default-radius overflow-x-auto border border-gray-100">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <tbody>
                  {diffs.map((d) => (
                    <tr key={`${d.id}-${d.op}`} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-3 py-2 text-gray-800">{d.label}</td>
                      <td className="px-3 py-2 text-gray-500">{opLabel(familyOf(d.id), d.op)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">
                        {TEXT.msChange(fmtMs(d.beforeMs), fmtMs(d.afterMs))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">
                        {d.change >= 0 ? "+" : ""}
                        {pct(d.change)}
                        <span className="ml-1 text-2xs text-gray-400">±{pct(d.noise)}</span>
                      </td>
                      <td className={`px-3 py-2 text-right text-xs font-medium ${VERDICT_STYLE[d.verdict]}`}>
                        {VERDICT_TEXT[d.verdict]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function SpeedTestModal({ onClose }: { onClose: () => void }) {
  const cancelled = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(DEFAULT_IDS));
  const [progress, setProgress] = useState<Progress | null>(null);
  const [live, setLive] = useState<AlgorithmResult[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>(() => loadHistory());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const running = progress !== null;
  const latest = runs[runs.length - 1];
  const shown = running ? live : (latest?.results ?? []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start() {
    if (selected.size === 0) {
      setError(TEXT.noneSelected);
      return;
    }
    cancelled.current = false;
    setError(null);
    setLive([]);
    setProgress({ done: 0, total: 1, label: "" });
    try {
      const results = await runSpeedTest(
        [...selected],
        setProgress,
        (r) => setLive((prev) => [...prev, r]),
        () => cancelled.current,
      );
      const record: RunRecord = { id: String(Date.now()), at: new Date().toISOString(), device: deviceSummary(), results };
      setRuns((prev) => saveHistory([...prev, record]));
    } catch (e) {
      if (!(e instanceof SpeedTestCancelled)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  const exportJson = latest ? JSON.stringify({ ...latest, note: TEXT.note }, null, 2) : "";

  return (
    <ModalShell title="PQC Speed Test" onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-5 pt-4">
        <p className="text-sm text-gray-600">{TEXT.intro}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {FAMILIES.map((family) => (
            <fieldset key={family} className="space-y-1" disabled={running}>
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {FAMILY_TITLES[family]}
              </legend>
              {ALGORITHMS.filter((a) => a.family === family).map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                  <span>{a.label}</span>
                  <span className="text-2xs uppercase tracking-wide text-gray-400">
                    {a.kind === "pqc" ? a.standard : TEXT.today}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LRButton type="button" onClick={start} disabled={running}>
            {latest ? TEXT.runAgain : TEXT.run}
          </LRButton>
          <LRButton type="button" variant="secondary-outline" disabled={running} onClick={() => setSelected(new Set(DEFAULT_IDS))}>
            {TEXT.defaults}
          </LRButton>
          <LRButton
            type="button"
            variant="secondary-outline"
            disabled={running}
            onClick={() => setSelected(new Set(ALGORITHMS.map((a) => a.id)))}
          >
            {TEXT.selectAll}
          </LRButton>
        </div>

        {running && progress && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="h-2 w-full overflow-hidden bg-gray-100">
              <div
                className="h-2 bg-[var(--brand-primary)] transition-[width] duration-300"
                style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{progress.label && TEXT.testing(progress.label)}</span>
              <button
                type="button"
                onClick={() => {
                  cancelled.current = true;
                }}
                className="cursor-pointer text-gray-500 hover:text-gray-800"
              >
                {TEXT.cancel}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="default-radius border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {shown.length > 0 && (
          <div className="space-y-5">
            {!running && latest && <p className="text-xs text-gray-500">{TEXT.measuredOn(latest.device)}</p>}
            <Headlines results={shown} />
            {FAMILIES.map((f) => (
              <ResultTable key={f} family={f} results={shown} />
            ))}
            <p className="text-xs text-gray-500">
              {TEXT.noise} {TEXT.note}
            </p>
            {!running && latest && (
              <div className="flex flex-wrap justify-end gap-2">
                <CopyButton value={exportJson} className="text-xs" label={TEXT.copy} />
                <DownloadButton
                  value={exportJson}
                  filename={`pqc-speed-test-${latest.id}.json`}
                  mimeType="application/json"
                  label={TEXT.download}
                />
              </div>
            )}
          </div>
        )}

        {!running && runs.length > 0 && (
          <History
            key={runs.length}
            runs={runs}
            onClear={() => {
              clearHistory();
              setRuns([]);
            }}
          />
        )}
      </div>
    </ModalShell>
  );
}