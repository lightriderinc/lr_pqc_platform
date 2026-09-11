import { handleSignOut } from "@/app/actions/auth";
import SignOut from "@/app/sign-out";
import SignInRequired from "@/components/auth/SignInRequired";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import { getAccountProfile, getDisplayName, getSession } from "@/lib/auth/session";

/**
 * Account page. Mirrors the cloud platform's /settings/account in structure,
 * typography, and class patterns so all three platforms read as one product.
 *
 * Gated inline rather than by a settings layout: these apps have other public
 * /settings routes, and a layout gate would silently lock those too.
 *
 * Display-only. Cloud's edit controls each need something this app does not
 * have: a database (avatar upload, plan badge) or Management API M2M
 * credentials (connected accounts, authoritative password status). The
 * password/email/MFA editors are portable in principle — end-user Account API
 * only — but each is a multi-step verification flow, tracked as follow-up
 * rather than half-built here.
 */
export default async function AccountPage() {
  const { isAuthenticated, userInfo, claims } = await getSession();

  if (!isAuthenticated) {
    return <SignInRequired target="your account settings" />;
  }

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
        <InitialsAvatar name={name || email || "Your account"} size={64} />
        <div className="min-w-0">
          {name && (
            <p className="text-3xl font-semibold text-gray-800 truncate">
              {name}
            </p>
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
