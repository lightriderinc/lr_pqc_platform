import InfoBox from "@/components/ui/InfoBox";
import SectionPanel from "@/components/ui/SectionPanel";

// Build-identity panel: the packaged build identity (certificate, version,
// library, hash, environment, PQC boundary) plus the boundary disclosure,
// shown as an info callout. Header sits outside the gray box (cloud-platform
// pattern). All values are "—" placeholders in this shell.

const RECORD_FIELDS = [
  "Certificate",
  "Module version",
  "Library",
  "SHA-256",
  "Environment",
  "PQC boundary",
];

export default function BuildIdentityPanel() {
  return (
    <SectionPanel title="Build identity">
      <dl>
        {RECORD_FIELDS.map((field) => (
          <div
            key={field}
            className="grid grid-cols-[130px_1fr] gap-3 border-b-2 border-gray-100 py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <dt className="text-2xs uppercase tracking-wider font-medium font-mono text-gray-500">
              {field}
            </dt>
            <dd className="m-0 break-words text-xs text-gray-500">—</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <InfoBox>
          <strong>Boundary disclosure</strong><br/> ML-KEM and ML-DSA are provided
          beside the v5 FIPS boundary.<br/>The dashboard never labels them as inside
          certificate #4718.
        </InfoBox>
      </div>
    </SectionPanel>
  );
}
