import { isExpired, isPrivateKey, isTestPath } from "@/lib/qsearch/tags";
import type { ScanResult } from "./ScanConsole";

/** Files listed per alert; the rest are counted. */
const MAX_LISTED = 5;

type Finding = ScanResult["findings"][number];

function Alert({ title, text, items }: { title: string; text: string; items: string[] }) {
  return (
    <div className="default-radius space-y-2 border border-red-100 bg-red-50 px-4 py-3" role="alert">
      <p className="text-sm font-semibold text-red-800">{title}</p>
      <p className="text-sm text-red-800">{text}</p>
      <ul className="space-y-0.5 font-mono text-xs text-red-700">
        {items.slice(0, MAX_LISTED).map((item) => (
          <li key={item} className="break-all">
            {item}
          </li>
        ))}
        {items.length > MAX_LISTED && <li className="font-sans">and {items.length - MAX_LISTED} more</li>}
      </ul>
    </div>
  );
}

const testNote = (asset: string) => (isTestPath(asset) ? `${asset} (test file)` : asset);

/** Problems that need action regardless of quantum risk. */
export default function ScanAlerts({ findings, at }: { findings: Finding[]; at: Date }) {
  const keys = [...new Set(findings.filter(isPrivateKey).map((f) => testNote(f.asset)))];
  const expired = findings.filter((f) => isExpired(f, at));
  if (keys.length === 0 && expired.length === 0) return null;

  return (
    <div className="grid gap-3">
      {keys.length > 0 && (
        <Alert
          title={`${keys.length} ${keys.length === 1 ? "file contains" : "files contain"} a private key`}
          text="Anyone who can read this code can use these keys. Replace them, then remove them from the repository and its history. Keys in test files are usually safe only if they were never used anywhere else."
          items={keys}
        />
      )}
      {expired.length > 0 && (
        <Alert
          title={`${expired.length} expired ${expired.length === 1 ? "certificate" : "certificates"}`}
          text="These certificates had expired when the scan ran. Anything still relying on them will fail to connect or verify."
          items={expired.map(
            (f) => `${f.certificate?.subject || f.asset}, expired ${new Date(f.certificate!.notValidAfter).toLocaleDateString()}`,
          )}
        />
      )}
    </div>
  );
}