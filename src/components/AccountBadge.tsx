import { MdAccountCircle } from "react-icons/md";

type Props = {
  name: string;
  email?: string;
};

// Signed-in indicator shown next to the sign-out button in the header (and in
// the mobile drawer). Purely presentational: Header resolves the Logto
// session claims and passes down whichever of name/email it found.
export default function AccountBadge({ name, email }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-1">
      <MdAccountCircle className="h-6 w-6 shrink-0 text-gray-400" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-gray-700">
          {name}
        </span>
        {email && email !== name && (
          <span className="truncate text-xs text-gray-500">{email}</span>
        )}
      </span>
    </div>
  );
}
