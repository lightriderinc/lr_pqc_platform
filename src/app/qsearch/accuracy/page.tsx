import Badge from "@/components/ui/Badge";
import SectionPanel from "@/components/ui/SectionPanel";
import TableShell from "@/components/ui/TableShell";
import { BENCHMARK, FOUND_AND_FIXED, LIMITS, MEASURED, REPOS, ROBUSTNESS, totals } from "@/lib/qsearch/accuracy";
import Link from "next/link";

export const metadata = { title: "qSearch accuracy | Light Rider PQC" };

const cell = "border-b border-gray-100 px-4 py-3 text-sm text-gray-700";

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
    return (
        <div className="default-radius border border-gray-100 bg-white p-4">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-500">{sub}</p>
        </div>
    );
}

/** What qSearch finds and misses, measured on public code and stated plainly. */
export default function AccuracyPage() {
    const t = totals();
    return (
        <div className="animate-fade-in-up space-y-8">
            <div className="space-y-2">
                <Link href="/qsearch" className="text-sm underline">
                    ← qSearch
                </Link>
                <h1 className="text-2xl font-semibold">qSearch accuracy</h1>
                <p className="text-sm text-gray-600">
                    What qSearch finds and what it misses, measured on {MEASURED.date} with {MEASURED.scanner}, the exact program
                    this website runs. The public tests use repositories pinned to exact commits, and the answers they are
                    checked against were worked out without qSearch, so anyone can repeat them.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat value={`${BENCHMARK.found} of ${BENCHMARK.expected}`} label="Uses of cryptography found" sub="Labelled benchmark, 7 languages and formats" />
                <Stat value={`${t.keysFound} of ${t.keysTruth}`} label="Files with a private key found" sub={`${t.falseReports} false reports, 3 public repositories`} />
                <Stat value={`${t.certsKeyCorrect} of ${t.certsFound}`} label="Certificate keys shown correctly" sub={`${t.certsFound} of ${t.certsTruth} certificates found`} />
                <Stat value={`${ROBUSTNESS.corruptedFiles.toLocaleString("en-US")}`} label="Corrupted files, no crash" sub="Damaged keys and certificates" />
            </div>

            <SectionPanel title="Keys and certificates in public code" cardStyle="p-0">
                <TableShell columns={["Repository", "Private-key files", "False reports", "Certificates", "Key shown correctly", "Scan time"]}>
                    {REPOS.map((r) => (
                        <tr key={r.repo}>
                            <td className={cell}>
                                <a href={`https://github.com/${r.repo}/tree/${r.commit}`} className="font-mono text-xs underline" rel="noreferrer" target="_blank">
                                    {r.repo}@{r.commit.slice(0, 12)}
                                </a>
                                <span className="block text-xs text-gray-500">{r.why}</span>
                            </td>
                            <td className={cell}>
                                {r.privateKeyFiles.found} of {r.privateKeyFiles.truth}
                            </td>
                            <td className={cell}>{r.privateKeyFiles.falseReports}</td>
                            <td className={cell}>{r.certificates.truth ? `${r.certificates.found} of ${r.certificates.truth}` : "—"}</td>
                            <td className={cell}>{r.certificates.found ? `${r.certificates.keyCorrect} of ${r.certificates.found}` : "—"}</td>
                            <td className={cell}>
                                {r.files.toLocaleString("en-US")} files, {r.seconds.toFixed(2)} s
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </SectionPanel>

            <SectionPanel title="How these were measured">
                <div className="space-y-3 text-sm text-gray-700">
                    <p>
                        <span className="font-medium">Private keys:</span> a file counts as containing one when it has a complete
                        key block: a BEGIN line, lines that are all key data (quoted or indented is fine), and the matching END
                        line. Parser code and documentation that only mention the marker text do not count.
                    </p>
                    <p>
                        <span className="font-medium">Certificates:</span> every certificate block is read with pyca/cryptography
                        50.0.2, an independent implementation, which gives its fingerprint, key type and size. Older versions refuse
                        some malformed test certificates, so counts can differ with them.
                    </p>
                    <p>
                        <span className="font-medium">Code patterns:</span> a benchmark of {BENCHMARK.inCode} labelled uses in code
                        and configuration ({BENCHMARK.languages}) plus {BENCHMARK.keyFiles} key files generated when the test runs,
                        and {BENCHMARK.decoys} decoys that mention an algorithm without using it. qSearch found all{" "}
                        {BENCHMARK.expected} uses, with {BENCHMARK.sizeErrors} key-size errors and {BENCHMARK.extraFindings} findings
                        outside the answer key. Of the decoys, {BENCHMARK.decoysAsComments} were correctly treated as comments and{" "}
                        {BENCHMARK.decoysFlagged} was reported (a log message). This benchmark is not public yet.
                    </p>
                    <p>
                        <span className="font-medium">Robustness:</span> {ROBUSTNESS.corruptedFiles.toLocaleString("en-US")} files
                        made by damaging {ROBUSTNESS.fromOriginals} real keys and certificates (bytes changed, removed or inserted)
                        were scanned and read by the website. Crashes: {ROBUSTNESS.crashes}.
                    </p>
                    <p>
                        <span className="font-medium">Program:</span> {MEASURED.scanner}, SHA-256{" "}
                        <span className="break-all font-mono text-xs">{MEASURED.binarySha256}</span>
                    </p>
                </div>
            </SectionPanel>

            <SectionPanel title="Known limits">
                <ul className="space-y-3 text-sm text-gray-700">
                    {LIMITS.map((l) => (
                        <li key={l.title}>
                            <span className="font-medium">{l.title}.</span> {l.detail}
                        </li>
                    ))}
                </ul>
            </SectionPanel>

            <SectionPanel title="Found by these measurements, and fixed">
                <ul className="space-y-2 text-sm text-gray-700">
                    {FOUND_AND_FIXED.map((f) => (
                        <li key={f.detail} className="flex flex-wrap items-start gap-2">
                            <Badge variant="ready">Fixed {f.date}</Badge>
                            <span className="flex-1">{f.detail}</span>
                        </li>
                    ))}
                </ul>
            </SectionPanel>
        </div>
    );
}