"use client";

import { saveInventory } from "@/app/qsearch/actions";
import Badge from "@/components/ui/Badge";
import AutoFill from "./AutoFill";
import DownloadButton from "@/components/ui/DownloadButton";
import LRButton from "@/components/ui/LRButton";
import SectionPanel from "@/components/ui/SectionPanel";
import TableShell from "@/components/ui/TableShell";
import {
  ADDABLE_ALGORITHMS,
  EMPTY_REVIEW,
  EMPTY_SYSTEM,
  EXCLUDE_REASONS,
  FIPS_199,
  HOSTING,
  SERVICES,
  SOFTWARE_TYPES,
  cleanReview,
  cleanSystem,
  inventoryCsv,
  inventoryJson,
  inventoryRows,
  isPriority,
  missingItems,
  type Exclusion,
  type InventoryRow,
  type Review,
  type SystemDetails,
} from "@/lib/qsearch/inventory";
import { useMemo, useState } from "react";
import type { ScanResult } from "./ScanConsole";

/** Form values as typed; cleaned with cleanSystem before use. */
type Form = Record<keyof SystemDetails, string>;

const toForm = (s: SystemDetails): Form =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === null ? "" : String(v)])) as Form;

const inputClass =
  "default-radius w-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300";
const cellClass = "border-b border-gray-100 px-4 py-3 text-sm text-gray-700";

/** Locations listed when a row is opened; the rest are counted. */
const MAX_SHOWN = 20;

/** The file part of a location such as "./src/app.py:12". */
const fileOf = (location: string) => location.replace(/:\d+$/, "");

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

/** A pending decision to set a row or a file aside, waiting for its reason. */
type Pending = { kind: Exclusion["kind"]; target: string; label: string };

const EMPTY_ADD = { algorithm: "RSA", service: "digital signatures", keyLength: "", source: "", note: "" };

/**
 * The scan as a federal cryptographic inventory: the system details only its
 * owner knows, each quantum-vulnerable cryptographic system found, and the
 * owner's review of them: rows and files set aside with a reason, and rows
 * added from sources a code scan cannot see.
 */
export default function InventoryExport({ result, at }: { result: ScanResult; at: Date }) {
  const [form, setForm] = useState<Form>(() => toForm(result.saved?.system ?? EMPTY_SYSTEM));
  const [review, setReview] = useState<Review>(() => result.saved?.review ?? EMPTY_REVIEW);
  const [includeTests, setIncludeTests] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState<Exclusion["reason"]>(EXCLUDE_REASONS[0]);
  const [reasonNote, setReasonNote] = useState("");
  const [adding, setAdding] = useState(EMPTY_ADD);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const system = useMemo(() => cleanSystem(form), [form]);
  const inv = useMemo(
    () => inventoryRows(result.findings, system, { includeTests, asOf: at, review }),
    [result, system, includeTests, at, review],
  );
  const priority = isPriority(system, at);
  const missing = missingItems(system);
  const project = result.saved?.project;
  const stamp = at.toISOString().slice(0, 10);
  const source = project ? `qSearch scan of ${project}, ${stamp}` : `qSearch scan, ${stamp} (not saved)`;
  const fileStem = `inventory-${project ?? "unsaved"}-${stamp}`;

  /** Every change goes through cleanReview, so limits hold before saving too. */
  function changeReview(next: Review) {
    setReview(cleanReview(next));
    setMessage(null);
  }

  const set = (key: keyof SystemDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setMessage(null);
  };

  function startExclusion(p: Pending) {
    setPending(p);
    setReason(EXCLUDE_REASONS[0]);
    setReasonNote("");
  }

  function confirmExclusion() {
    if (!pending) return;
    changeReview({
      ...review,
      exclusions: [...review.exclusions, { kind: pending.kind, target: pending.target, reason, note: reasonNote }],
    });
    setPending(null);
    setOpenRow(null);
  }

  function restore(kind: Exclusion["kind"], target: string) {
    changeReview({ ...review, exclusions: review.exclusions.filter((e) => !(e.kind === kind && e.target === target)) });
  }

  function removeAdded(row: InventoryRow) {
    const index = Number(row.key.slice("added:".length));
    changeReview({ ...review, additions: review.additions.filter((_, i) => i !== index) });
  }

  function addRow() {
    if (!adding.source.trim()) return;
    changeReview({ ...review, additions: [...review.additions, adding as Review["additions"][number]] });
    setAdding(EMPTY_ADD);
  }

  async function save() {
    if (!result.saved) return;
    setSaving(true);
    try {
      const response = await saveInventory(result.saved.id, system, review);
      setMessage(
        response.ok
          ? { text: `Saved. Later scans of ${project} will start with these details and this review.`, error: false }
          : { text: response.error, error: true },
      );
    } catch {
      setMessage({ text: "The inventory did not reach the server. Check your connection and try again.", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionPanel
      title="Cryptographic inventory (OMB M-23-02 data items)"
      action={<Badge>{inv.rows.length} quantum-vulnerable cryptographic {inv.rows.length === 1 ? "system" : "systems"}</Badge>}
    >
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Item 4 comes from this scan. Fill in the other items for the system. Priority and target phases follow OMB
          M-26-15.
        </p>
        <p className="text-xs text-gray-500">
          Not an official submission form. Details can be sensitive: save them only if your organization allows it.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="1. FISMA system identifier"
            hint="An identifier only. M-23-02 says not to use names that reveal the system's function or location."
          >
            <input className={inputClass} value={form.fismaId} onChange={set("fismaId")} maxLength={64} />
          </Field>
          <Field label="2. FIPS 199 categorization">
            <select className={inputClass} value={form.fips199} onChange={set("fips199")}>
              <option value="">Not set</option>
              {FIPS_199.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="3. HVA identifier" hint="Only if the system is a High Value Asset.">
            <input className={inputClass} value={form.hvaId} onChange={set("hvaId")} maxLength={64} />
          </Field>
          <Field label="5. Software package">
            <div className="flex gap-2">
              <select className={`${inputClass} max-w-36`} value={form.softwareType} onChange={set("softwareType")}>
                <option value="">Type</option>
                {SOFTWARE_TYPES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <input
                className={inputClass}
                value={form.vendor}
                onChange={set("vendor")}
                placeholder="Vendor or developer"
                maxLength={120}
              />
            </div>
          </Field>
          <Field label="6. Operating systems" hint="Include major and minor versions, such as Ubuntu 22.04.">
            <input className={inputClass} value={form.operatingSystems} onChange={set("operatingSystems")} maxLength={200} />
          </Field>
          <Field label="7. Hosting">
            <div className="flex gap-2">
              <select className={`${inputClass} max-w-44`} value={form.hosting} onChange={set("hosting")}>
                <option value="">Not set</option>
                {HOSTING.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <input
                className={inputClass}
                value={form.hostingProvider}
                onChange={set("hostingProvider")}
                placeholder="Provider name"
                disabled={form.hosting === "On premise"}
                maxLength={120}
              />
            </div>
          </Field>
          <Field label="8a. Data types" hint="Records categories the system holds.">
            <input className={inputClass} value={form.dataTypes} onChange={set("dataTypes")} maxLength={300} />
          </Field>
          <Field label="8b. Years the data must stay secret" hint="Still sensitive in 2030 or later makes the system a priority.">
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={form.protectYears}
              onChange={set("protectYears")}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="9. Notes">
              <textarea className={inputClass} rows={2} value={form.notes} onChange={set("notes")} maxLength={1000} />
            </Field>
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <p className={priority ? "font-medium text-red-700" : "text-gray-700"}>
            {priority
              ? "Priority under M-26-15: migrate key establishment to post-quantum by the end of 2030, and signatures in 2031."
              : "Not a priority system under M-26-15 on these details: full migration is due by 2035."}
          </p>
          {missing.length > 0 && <p className="text-amber-700">Still needed: {missing.join(", ")}.</p>}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">4. Cryptographic systems: review</h3>
          <p className="text-sm text-gray-600">
            Exclude rows or files that are not real use, such as algorithm names in text or data. Add what a code scan
            cannot see: sign-in provider keys and server TLS.
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} />
            Include test files (left out by default: M-23-02 covers cryptography in active use)
          </label>
        </div>

        {inv.rows.length === 0 ? (
          <p className="text-sm text-gray-500">No quantum-vulnerable cryptographic systems to report.</p>
        ) : (
          <TableShell columns={["Algorithm", "Service", "Key length", "Occurrences", "Target phase", ""]}>
            {inv.rows.map((r) => (
              <RowView
                key={r.key}
                row={r}
                open={openRow === r.key}
                onToggle={() => setOpenRow(openRow === r.key ? null : r.key)}
                onExcludeRow={() =>
                  startExclusion({ kind: "row", target: r.key, label: `${r.algorithm}, ${r.service}, ${r.keyLength}` })
                }
                onExcludeFile={(file) => startExclusion({ kind: "file", target: file, label: `every finding in ${file}` })}
                onRemove={() => removeAdded(r)}
              />
            ))}
          </TableShell>
        )}

        {pending && (
          <div className="default-radius space-y-3 border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-gray-800">Exclude {pending.label}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Reason">
                <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value as Exclusion["reason"])}>
                  {EXCLUDE_REASONS.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Note (optional)">
                <input
                  className={inputClass}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  maxLength={300}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <LRButton type="button" variant="secondary-outline" onClick={confirmExclusion}>
                Exclude
              </LRButton>
              <LRButton type="button" variant="secondary-outline" onClick={() => setPending(null)}>
                Cancel
              </LRButton>
            </div>
          </div>
        )}

        {inv.excluded.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Excluded ({inv.excluded.length})</h3>
            <ul className="space-y-1 text-sm">
              {inv.excluded.map((r) => {
                const kind = r.key.startsWith("file:") ? "file" : "row";
                const target = kind === "file" ? r.key.slice("file:".length) : r.key;
                return (
                  <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-2">
                    <span className="min-w-0 text-gray-700">
                      {kind === "file" ? (
                        <span className="break-all font-mono text-xs">{target}</span>
                      ) : (
                        `${r.algorithm}, ${r.service}, ${r.keyLength}`
                      )}
                      <span className="text-gray-500">
                        {" "}
                        · {r.occurrences} {r.occurrences === 1 ? "finding" : "findings"} · {r.reason}
                      </span>
                    </span>
                    <LRButton type="button" variant="secondary-outline" onClick={() => restore(kind, target)}>
                      Restore
                    </LRButton>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="default-radius space-y-3 border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-800">Add cryptography the scan cannot see</h3>
          <AutoFill
            onAdd={(rows) => {
              // Rows already in the inventory are not added twice.
              const have = new Set(review.additions.map((a) => JSON.stringify([a.algorithm, a.service, a.keyLength, a.source])));
              const fresh = rows.filter((r) => !have.has(JSON.stringify([r.algorithm, r.service, r.keyLength, r.source])));
              changeReview({ ...review, additions: [...review.additions, ...fresh] });
            }}
          />
          <p className="pt-2 text-sm text-gray-600">Or add by hand:</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Algorithm">
              <select
                className={inputClass}
                value={adding.algorithm}
                onChange={(e) => setAdding({ ...adding, algorithm: e.target.value })}
              >
                {ADDABLE_ALGORITHMS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Service">
              <select
                className={inputClass}
                value={adding.service}
                onChange={(e) => setAdding({ ...adding, service: e.target.value })}
              >
                {SERVICES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Key length">
              <input
                className={inputClass}
                value={adding.keyLength}
                onChange={(e) => setAdding({ ...adding, keyLength: e.target.value })}
                placeholder="2048 bits, P-256…"
                maxLength={40}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Where it is used" hint="Required. For example: Logto sign-in tokens, or tls://api.example.com:443.">
                <input
                  className={inputClass}
                  value={adding.source}
                  onChange={(e) => setAdding({ ...adding, source: e.target.value })}
                  maxLength={200}
                />
              </Field>
            </div>
            <Field label="Note (optional)">
              <input
                className={inputClass}
                value={adding.note}
                onChange={(e) => setAdding({ ...adding, note: e.target.value })}
                maxLength={300}
              />
            </Field>
          </div>
          <LRButton type="button" variant="secondary-outline" onClick={addRow} disabled={!adding.source.trim()}>
            Add to inventory
          </LRButton>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {result.saved ? (
            <LRButton type="button" variant="secondary-outline" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save inventory"}
            </LRButton>
          ) : (
            <p className="text-sm text-gray-500">
              This scan is not saved, so these details and this review are lost when you leave the page. They are still
              included in the downloads.
            </p>
          )}
          {message && <p className={`text-sm ${message.error ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <DownloadButton
            label="Inventory (CSV)"
            value={inventoryCsv(inv, system, at, source)}
            filename={`${fileStem}.csv`}
            mimeType="text/csv"
          />
          <DownloadButton
            label="Inventory (JSON)"
            value={inventoryJson(inv, system, at, source)}
            filename={`${fileStem}.json`}
            mimeType="application/json"
          />
        </div>
      </div>
    </SectionPanel>
  );
}

/** One inventory row, which opens to show where it was found. */
function RowView({
  row,
  open,
  onToggle,
  onExcludeRow,
  onExcludeFile,
  onRemove,
}: {
  row: InventoryRow;
  open: boolean;
  onToggle: () => void;
  onExcludeRow: () => void;
  onExcludeFile: (file: string) => void;
  onRemove: () => void;
}) {
  const files = [...new Set(row.locations.map(fileOf))];
  return (
    <>
      <tr>
        <td className={`${cellClass} text-gray-800`}>
          {row.algorithm}
          {row.origin === "added" && <span className="ml-2 text-xs text-gray-400">added</span>}
        </td>
        <td className={cellClass}>{row.service}</td>
        <td className={cellClass}>{row.keyLength}</td>
        <td className={cellClass}>{row.occurrences}</td>
        <td className={cellClass}>{row.target}</td>
        <td className={cellClass}>
          <div className="flex justify-end gap-2">
            <LRButton type="button" variant="secondary-outline" onClick={onToggle}>
              {open ? "Hide" : "Where"}
            </LRButton>
            {row.origin === "added" ? (
              <LRButton type="button" variant="danger-outline" onClick={onRemove}>
                Remove
              </LRButton>
            ) : (
              <LRButton type="button" variant="secondary-outline" onClick={onExcludeRow}>
                Exclude
              </LRButton>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            {row.origin === "added" ? (
              <p className="text-sm text-gray-700">{row.locations[0]}</p>
            ) : (
              <ul className="space-y-1">
                {files.slice(0, MAX_SHOWN).map((file) => (
                  <li key={file} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-xs text-gray-600">
                      {row.locations.filter((l) => fileOf(l) === file).join(", ")}
                    </span>
                    <LRButton type="button" variant="secondary-outline" onClick={() => onExcludeFile(file)}>
                      Exclude this file
                    </LRButton>
                  </li>
                ))}
                {files.length > MAX_SHOWN && (
                  <li className="text-xs text-gray-500">and {files.length - MAX_SHOWN} more files</li>
                )}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}