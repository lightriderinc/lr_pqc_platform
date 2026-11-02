"use client";

import InfoBox from "@/components/ui/InfoBox";
import LRButton from "@/components/ui/LRButton";
import {
  RunCancelled,
  parseVectorFile,
  runVectors,
  runnableCount,
  type TestResult,
  type VectorFile,
} from "@/lib/pqc/testVectors";
import { FUNCTIONS, TEXT, VECTOR_FILE, type FunctionId } from "@/lib/pqc/testVectorConfig";
import { useEffect, useRef, useState } from "react";
import { MdCancel, MdCheckCircle } from "react-icons/md";
import ModalShell from "./ModalShell";

const keyOf = (r: { functionId: string; tcId: number }) => `${r.functionId}:${r.tcId}`;

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; file: VectorFile };

export default function TestVectorModal({ onClose }: { onClose: () => void }) {
  const cancelled = useRef(false);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [tamper, setTamper] = useState(false);
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [running, setRunning] = useState(false);
  const [ranTamper, setRanTamper] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    cancelled.current = false;
    const controller = new AbortController();
    fetch(VECTOR_FILE, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(TEXT.loadFailed);
        return res.json();
      })
      .then((data) => setLoad({ state: "ready", file: parseVectorFile(data) }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setLoad({ state: "error", message: e instanceof Error ? e.message : TEXT.loadFailed });
      });
    return () => {
      cancelled.current = true;
      controller.abort();
    };
  }, []);

  async function run(file: VectorFile) {
    cancelled.current = false;
    setResults(new Map());
    setSelected(null);
    setRunning(true);
    setRanTamper(tamper);
    try {
      await runVectors(
        file,
        tamper,
        (r) => setResults((prev) => new Map(prev).set(keyOf(r), r)),
        () => cancelled.current,
      );
    } catch (e) {
      if (!(e instanceof RunCancelled)) throw e;
    } finally {
      setRunning(false);
    }
  }

  const all = [...results.values()];
  const passed = all.filter((r) => r.pass).length;
  const selectedResult = selected ? results.get(selected) : undefined;

  return (
    <ModalShell title="Test Vector Check" onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-5 pt-4">
        <p className="text-sm text-gray-600">{TEXT.intro}</p>
        <InfoBox>{TEXT.privacy}</InfoBox>

        {load.state === "loading" && <p className="text-sm text-gray-500">{TEXT.loading}</p>}
        {load.state === "error" && (
          <p className="default-radius border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {load.message}
          </p>
        )}

        {load.state === "ready" && (
          <>
            <div className="space-y-1 text-xs text-gray-500">
              <p>
                {TEXT.source(load.file.source.name, load.file.source.retrieved.slice(0, 10))}{" "}
                <a
                  href={load.file.source.page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 underline underline-offset-2 hover:text-[var(--brand-primary)]"
                >
                  {TEXT.sourceLink}
                </a>
              </p>
              <p>{TEXT.library(load.file.library.name, load.file.library.version)}</p>
              <p>{TEXT.totals(runnableCount(load.file))}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <LRButton type="button" onClick={() => run(load.file)} disabled={running}>
                {running ? TEXT.running : all.length ? TEXT.runAgain : TEXT.run}
              </LRButton>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={tamper} disabled={running} onChange={(e) => setTamper(e.target.checked)} />
                {TEXT.tamper}
              </label>
              {running && (
                <>
                  <span className="font-mono text-sm text-gray-600">
                    {all.length} / {runnableCount(load.file)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      cancelled.current = true;
                    }}
                    className="cursor-pointer text-sm text-gray-500 hover:text-gray-800"
                  >
                    {TEXT.cancel}
                  </button>
                </>
              )}
            </div>

            {!running && all.length > 0 && (
              <div
                className={`default-radius flex items-start gap-2 border p-3 ${
                  passed === all.length ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"
                }`}
                role="status"
              >
                {passed === all.length ? (
                  <MdCheckCircle className="mt-0.5 shrink-0 text-xl text-green-700" />
                ) : (
                  <MdCancel className="mt-0.5 shrink-0 text-xl text-red-700" />
                )}
                <div className="space-y-1 text-sm">
                  <p className={`font-semibold ${passed === all.length ? "text-green-800" : "text-red-800"}`}>
                    {passed === all.length ? TEXT.allPassed(all.length) : TEXT.someFailed(all.length - passed, all.length)}
                  </p>
                  {ranTamper && <p className="text-gray-700">{TEXT.tamperNote}</p>}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {load.file.functions
                .filter((fn) => Object.hasOwn(FUNCTIONS, fn.id))
                .map((fn) => {
                  const info = FUNCTIONS[fn.id as FunctionId];
                  const tests = fn.groups.flatMap((g) => g.tests.map((t) => ({ set: g.parameterSet, tcId: t.tcId })));
                  const done = tests.map((t) => results.get(`${fn.id}:${t.tcId}`)).filter((r) => r !== undefined);
                  return (
                    <section key={fn.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800">
                          {info.label}
                          <span className="ml-2 text-2xs uppercase tracking-wide text-gray-400">{info.standard}</span>
                        </p>
                        <p className="font-mono text-xs text-gray-500">
                          {TEXT.counts(done.filter((r) => r.pass).length, tests.length)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tests.map((t) => {
                          const key = `${fn.id}:${t.tcId}`;
                          const r = results.get(key);
                          const color = !r ? "bg-gray-100" : r.pass ? "bg-green-500" : "bg-red-500";
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={!r}
                              onClick={() => setSelected(key)}
                              title={r ? TEXT.testDetail(t.tcId, t.set, r.pass) : undefined}
                              aria-label={r ? TEXT.testDetail(t.tcId, t.set, r.pass) : undefined}
                              className={`h-3 w-3 ${color} ${selected === key ? "outline outline-2 outline-gray-900" : ""} ${r ? "cursor-pointer" : ""}`}
                            />
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>

            {all.length > 0 && (
              <div className="default-radius min-h-[3rem] bg-gray-50 p-3 text-sm text-gray-700">
                {selectedResult ? (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {FUNCTIONS[selectedResult.functionId].label}.{" "}
                      {TEXT.testDetail(selectedResult.tcId, selectedResult.parameterSet, selectedResult.pass)}
                    </p>
                    {selectedResult.expectsRejection && <p>{TEXT.expectsRejection}</p>}
                    {selectedResult.reason && <p>{TEXT.reason(selectedResult.reason)}</p>}
                  </div>
                ) : (
                  <p className="text-gray-500">{TEXT.tileHint}</p>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500">{TEXT.disclaimer}</p>
          </>
        )}
      </div>
    </ModalShell>
  );
}