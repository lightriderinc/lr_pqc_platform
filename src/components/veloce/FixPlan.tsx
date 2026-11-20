"use client";

import Badge from "@/components/ui/Badge";
import DownloadButton from "@/components/ui/DownloadButton";
import SectionPanel from "@/components/ui/SectionPanel";
import { FORMATS, buildFixPlan, fixPlanMarkdown, places, type FixFinding, type PlanItem } from "@/lib/qsearch/fixes";
import { useMemo, useState } from "react";

/** Locations listed per fix; the rest are counted. */
const MAX_SHOWN = 10;

/** A code example with a copy button. */
function CodeBlock({ language, text }: { language: string; text: string }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard not available: the text can still be selected */
        }
    }
    return (
        <div className="default-radius overflow-hidden border border-gray-200">
            <div className="flex items-center justify-between bg-gray-100 px-3 py-1 text-xs text-gray-500">
                <span>{FORMATS[language]?.label ?? language}</span>
                <button type="button" onClick={copy} className="font-medium text-gray-700 hover:underline">
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <pre className="overflow-x-auto bg-white px-3 py-2 text-xs leading-relaxed text-gray-800">
                <code>{text}</code>
            </pre>
        </div>
    );
}

function Item({ item }: { item: PlanItem }) {
    const { fix, count, locations } = item;
    return (
        <details className="default-radius group border border-gray-100 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-gray-800">{fix.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                    {places(count, locations)}
                    <span className="transition group-open:rotate-90">›</span>
                </span>
            </summary>
            <div className="space-y-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                <p>{fix.why}</p>
                {fix.requires && (
                    <p>
                        <span className="font-medium">Requires: </span>
                        {fix.requires}
                    </p>
                )}
                <ol className="list-decimal space-y-1 pl-5">
                    {fix.steps.map((s) => (
                        <li key={s}>{s}</li>
                    ))}
                </ol>
                {fix.code && <CodeBlock language={fix.code.language} text={fix.code.text} />}
                {fix.verify && (
                    <p>
                        <span className="font-medium">Check it worked: </span>
                        {fix.verify}
                    </p>
                )}
                <div>
                    <p className="font-medium">Where</p>
                    <ul className="mt-1 space-y-0.5 font-mono text-xs text-gray-500">
                        {locations.slice(0, MAX_SHOWN).map((l) => (
                            <li key={l} className="break-all">
                                {l}
                            </li>
                        ))}
                        {locations.length > MAX_SHOWN && <li>and {locations.length - MAX_SHOWN} more</li>}
                    </ul>
                </div>
            </div>
        </details>
    );
}

/**
 * How to fix every finding, grouped by the kind of work: fix now, change
 * configuration, migrate code, or plan with vendors and standards.
 */
export default function FixPlan({ findings, at }: { findings: FixFinding[]; at: Date }) {
    const [includeTests, setIncludeTests] = useState(false);
    const plan = useMemo(() => buildFixPlan(findings, { includeTests, now: at }), [findings, includeTests, at]);
    const stamp = at.toISOString().slice(0, 10);

    return (
        <SectionPanel title="Fix plan" action={<Badge>{plan.total} findings need a fix</Badge>}>
            <div className="space-y-6">
                <p className="text-sm text-gray-600">
                    How to fix each finding, in the order to do it. Code examples were tested with the versions named; check them
                    against your own setup before deploying.
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} />
                    Include test files (private keys are always included)
                </label>

                {plan.groups.length === 0 ? (
                    <p className="text-sm text-gray-500">Nothing to fix: no quantum-vulnerable or broken cryptography in use was found.</p>
                ) : (
                    plan.groups.map((g) => (
                        <div key={g.group} className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-800">{g.label}</h3>
                            <p className="text-sm text-gray-600">{g.intro}</p>
                            {g.items.map((item) => (
                                <Item key={item.fix.id} item={item} />
                            ))}
                        </div>
                    ))
                )}

                {plan.total > 0 && (
                    <div className="flex justify-end">
                        <DownloadButton
                            label="Fix plan (Markdown)"
                            value={fixPlanMarkdown(plan, `qSearch scan, ${stamp}`)}
                            filename={`fix-plan-${stamp}.md`}
                            mimeType="text/markdown"
                        />
                    </div>
                )}
            </div>
        </SectionPanel>
    );
}