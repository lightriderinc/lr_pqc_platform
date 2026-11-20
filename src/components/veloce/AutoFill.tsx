"use client";

import { runProviderCheck, runServerCheck } from "@/app/qsearch/actions";
import LRButton from "@/components/ui/LRButton";
import { providerRows, serverRows, type Suggestions } from "@/lib/qsearch/additions";
import type { AddedRow } from "@/lib/qsearch/inventory";
import { useState } from "react";

const inputClass =
    "default-radius w-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300";

const CONNECTION_FAILED = "The check did not complete. Check your connection and try again.";

/**
 * Finds cryptography a code scan cannot see, from a sign-in provider's
 * published keys or a server's TLS settings, and offers it as inventory rows.
 */
export default function AutoFill({ onAdd }: { onAdd: (rows: AddedRow[]) => void }) {
    const [provider, setProvider] = useState("");
    const [server, setServer] = useState("");
    const [busy, setBusy] = useState<"provider" | "server" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [found, setFound] = useState<(Suggestions & { title: string }) | null>(null);
    const [picked, setPicked] = useState<boolean[]>([]);

    function show(title: string, s: Suggestions) {
        setFound({ ...s, title });
        setPicked(s.rows.map(() => true));
    }

    async function check(kind: "provider" | "server") {
        setBusy(kind);
        setError(null);
        setFound(null);
        try {
            if (kind === "provider") {
                const r = await runProviderCheck(provider);
                if (r.ok) show(`Signing keys published by ${r.data.host}`, providerRows(r.data));
                else setError(r.error);
            } else {
                const r = await runServerCheck(server, undefined);
                if (r.ok) show(`${r.data.host}:${r.data.port}`, serverRows(r.data));
                else setError(r.error);
            }
        } catch {
            setError(CONNECTION_FAILED);
        } finally {
            setBusy(null);
        }
    }

    function add() {
        if (!found) return;
        onAdd(found.rows.filter((_, i) => picked[i]));
        setFound(null);
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600">
                Fill automatically from a sign-in provider&apos;s published keys, or from a server&apos;s TLS settings.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (provider.trim() && !busy) check("provider");
                    }}
                >
                    <input
                        className={inputClass}
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        placeholder="Sign-in provider, such as yourtenant.logto.app"
                        aria-label="Sign-in provider"
                        maxLength={300}
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <LRButton type="submit" variant="secondary-outline" disabled={!provider.trim() || busy !== null}>
                        {busy === "provider" ? "Checking…" : "Check provider"}
                    </LRButton>
                </form>
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (server.trim() && !busy) check("server");
                    }}
                >
                    <input
                        className={inputClass}
                        value={server}
                        onChange={(e) => setServer(e.target.value)}
                        placeholder="Server, such as api.example.com or mail.example.com:993"
                        aria-label="Server"
                        maxLength={300}
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <LRButton type="submit" variant="secondary-outline" disabled={!server.trim() || busy !== null}>
                        {busy === "server" ? "Checking…" : "Check server"}
                    </LRButton>
                </form>
            </div>

            {error && (
                <p className="text-sm text-red-600" role="alert">
                    {error}
                </p>
            )}

            {found && (
                <div className="default-radius space-y-2 border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-800">{found.title}</p>
                    {found.rows.length === 0 && <p className="text-sm text-gray-600">No quantum-vulnerable cryptography found here.</p>}
                    {found.rows.map((row, i) => (
                        <label key={i} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                className="mt-1"
                                checked={picked[i] ?? false}
                                onChange={(e) => setPicked(picked.map((p, j) => (j === i ? e.target.checked : p)))}
                            />
                            <span>
                                {row.algorithm} · {row.service} · {row.keyLength || "size not published"}
                                <span className="block text-xs text-gray-500">
                                    {row.source} · {row.note}
                                </span>
                            </span>
                        </label>
                    ))}
                    {found.safe.map((s) => (
                        <p key={s} className="text-sm text-green-700">
                            Already post-quantum: {s}
                        </p>
                    ))}
                    <div className="flex gap-2">
                        {found.rows.length > 0 && (
                            <LRButton type="button" variant="secondary-outline" onClick={add} disabled={!picked.some(Boolean)}>
                                Add selected ({picked.filter(Boolean).length})
                            </LRButton>
                        )}
                        <LRButton type="button" variant="secondary-outline" onClick={() => setFound(null)}>
                            Dismiss
                        </LRButton>
                    </div>
                </div>
            )}
        </div>
    );
}