"use client";

import { saveSystemDetails } from "@/app/qsearch/actions";
import Badge from "@/components/ui/Badge";
import DownloadButton from "@/components/ui/DownloadButton";
import LRButton from "@/components/ui/LRButton";
import SectionPanel from "@/components/ui/SectionPanel";
import TableShell from "@/components/ui/TableShell";
import {
  EMPTY_SYSTEM,
  FIPS_199,
  HOSTING,
  SOFTWARE_TYPES,
  cleanSystem,
  inventoryCsv,
  inventoryJson,
  inventoryRows,
  isPriority,
  missingItems,
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

/**
 * The scan as a federal cryptographic inventory: the system details only its
 * owner knows, plus each quantum-vulnerable cryptographic system found.
 */
export default function InventoryExport({ result, at }: { result: ScanResult; at: Date }) {
  const [form, setForm] = useState<Form>(() => toForm(result.saved?.system ?? EMPTY_SYSTEM));
  const [includeTests, setIncludeTests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const system = useMemo(() => cleanSystem(form), [form]);
  const rows = useMemo(
    () => inventoryRows(result.findings, system, { includeTests, asOf: at }),
    [result, system, includeTests, at],
  );
  const priority = isPriority(system, at);
  const missing = missingItems(system);
  const project = result.saved?.project ?? "scan";
  const source = `qSearch scan of ${project}, ${at.toISOString().slice(0, 10)}`;
  const stamp = at.toISOString().slice(0, 10);

  const set = (key: keyof SystemDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setMessage(null);
  };

  async function save() {
    if (!result.saved) return;
        setSaving(true);
    try {
      const response = await saveSystemDetails(result.saved.id, system);
      setMessage(
        response.ok
          ? { text: `Saved. Later scans of ${project} will start with these details.`, error: false }
          : { text: response.error, error: true },
      );
    } catch {
      setMessage({ text: "The details did not reach the server. Check your connection and try again.", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionPanel
        title="Cryptographic inventory (OMB M-23-02 data items)"
      action={<Badge>{rows.length} quantum-vulnerable cryptographic {rows.length === 1 ? "system" : "systems"}</Badge>}
    >
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          OMB M-23-02 asks for nine items about each information system. Item 4, the quantum-vulnerable cryptography,
          comes from this scan. The other items describe the system, and only its owner can supply them. OMB M-26-15
                    (June 2026) asks for this inventory to be kept current and sets the order of migration used below.
        </p>
        <p className="text-xs text-gray-500">
          This organizes the data those memos ask for; it is not an official submission form. Agencies submit through
          the procedure ONCD and CISA publish, and each agency decides its own priorities. Inventory details can be
          sensitive: save them here only if your organization allows it. Otherwise fill them in, download, and leave
          without saving.
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
          <Field label="8. Data types" hint="As described by national records management categories.">
            <input className={inputClass} value={form.dataTypes} onChange={set("dataTypes")} maxLength={300} />
          </Field>
          <Field label="8. Years the data needs protection" hint={`Data still sensitive in 2030 makes the system a priority.`}>
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

        <div className="flex flex-wrap items-center gap-3">
          {result.saved ? (
            <LRButton type="button" variant="secondary-outline" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </LRButton>
          ) : (
            <p className="text-sm text-gray-500">
              This scan is not saved, so these details are lost when you leave the page. They are still included in the
              downloads.
            </p>
          )}
          {message && <p className={`text-sm ${message.error ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} />
          Include test files (left out by default: M-23-02 covers cryptography in active use)
        </label>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No quantum-vulnerable cryptographic systems to report from this scan.</p>
        ) : (
          <TableShell columns={["Algorithm", "Service", "Key length", "Occurrences", "Target phase"]}>
            {rows.map((r) => (
              <tr key={`${r.algorithm}|${r.service}|${r.keyLength}`}>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-800">{r.algorithm}</td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">{r.service}</td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">{r.keyLength}</td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">{r.occurrences}</td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">{r.target}</td>
              </tr>
            ))}
          </TableShell>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <DownloadButton
            label="Inventory (CSV)"
            value={inventoryCsv(rows, system, at, source)}
            filename={`inventory-${project}-${stamp}.csv`}
            mimeType="text/csv"
          />
          <DownloadButton
            label="Inventory (JSON)"
            value={inventoryJson(rows, system, at, source)}
            filename={`inventory-${project}-${stamp}.json`}
            mimeType="application/json"
          />
        </div>
      </div>
    </SectionPanel>
  );
}