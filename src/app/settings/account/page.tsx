import { handleSignOut } from "@/app/actions/auth";
import SignOut from "@/app/sign-out";
import { getAccountProfile, getDisplayName, getSession } from "@/lib/auth/session";

/**
 * Account page. Mirrors the cloud platform's /settings/account in structure,
 * typography, and class patterns so the two platforms read as one product.
 *
 * Display-only for now, by design rather than omission. Cloud's edit controls
 * split into three groups, and only one of them is portable here today:
 *   - Supabase-backed avatar upload and the Stripe/Prisma plan badge have no
 *     backend in this app at all.
 *   - Connected accounts and authoritative password status come from Logto's
 *     Management API, which needs machine-to-machine credentials this app has
 *     no registered app for.
 *   - The password / email / MFA editors are portable in principle (end-user
 *     Account API only), but each is a multi-step verification flow; they are
 *     tracked as follow-up work rather than half-built here.
 */
export default async function AccountPage() {
  const { userInfo, claims } = await getSession();
  const name = await getDisplayName();
  const account = await getAccountProfile();

  const email = userInfo?.email ?? (claims?.email as string | undefined) ?? null;
  const birthdate = account?.profile?.birthdate ?? null;

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold text-gray-700">Account</h1>
      <p className="mb-12 text-sm text-gray-500">
        Your Light Rider account details.
      </p>

      <div className="flex items-center gap-4 mb-12">
        <AccountAvatar label={name || email || "Your account"} />
        <div className="min-w-0">
          {name && (
            <p className="text-3xl font-semibold text-gray-800 truncate">
              {name}
            </p>
          )}
          {email && (
            <p className="text-sm text-gray-500 truncate">{email}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col mb-5">
        <div className="flex w-full mb-5">
          <h2 className="text-xl font-bold text-gray-500">Profile</h2>
        </div>

        <div className="flex flex-col default-radius divide-y divide-gray-100 mb-8 max-w-3xl bg-gray-50 px-4 py-1">
          <InfoRow label="Full Name" value={name} />
          <InfoRow label="Birthdate" value={formatBirthdate(birthdate)} />
          <InfoRow label="Email" value={email} />
        </div>
      </div>

      <div className="mt-6">
        <SignOut onSignOut={handleSignOut} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-row justify-between items-center">
      <div className="flex items-center py-3 gap-6 min-w-0">
        <dt className="text-sm font-bold text-gray-700 flex-shrink-0 w-24">
          {label}
        </dt>
        <dd className="text-base text-gray-400 truncate flex-1">
          {value || "—"}
        </dd>
      </div>
    </div>
  );
}

function AccountAvatar({ label }: { label: string }) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      aria-hidden="true"
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xl font-semibold text-gray-600"
    >
      {initials || "?"}
    </div>
  );
}

/**
 * Logto stores birthdate as a plain `YYYY-MM-DD` string. Constructing the Date
 * from parts keeps it at local midnight — `new Date("1990-01-01")` parses as
 * UTC and can render as the previous day for anyone west of Greenwich.
 */
function formatBirthdate(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const [year, month, day] = birthdate.split("-").map(Number);
  if (!year || !month || !day) return birthdate;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
