import InitialsAvatar from "@/components/ui/InitialsAvatar";
import Link from "next/link";

type Props = {
  name: string;
};

/** Signed-in indicator in the header (and mobile drawer). Mirrors the cloud
 *  platform's UserCard in its non-dropdown form, class for class. */
export default function AccountBadge({ name }: Props) {
  return (
    <Link
      href="/settings/account"
      className="flex items-center gap-3 default-radius pl-2 pr-5 py-1.5 transition-colors hover:bg-gray-100 cursor-pointer"
    >
      <InitialsAvatar name={name} size={32} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-gray-700">
          {name}
        </span>
      </span>
    </Link>
  );
}
