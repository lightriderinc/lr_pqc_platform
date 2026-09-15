type Props = {
  /** Name the initials are derived from. */
  name: string;
  /** Rendered edge length in px. 32 in the header badge, 64 on the account page. */
  size: number;
  className?: string;
};

/** Initials avatar, matching the cloud platform's AvatarImage exactly: a
 *  rounded-square tile (`default-radius`, NOT a circle) with a light border,
 *  and initials in `text-gray-300` sized at ~36% of the tile.
 *
 *  Cloud's version also tries an uploaded picture and a generated fallback
 *  before landing on initials; this app has neither, so only the initials
 *  branch is reproduced. The result is pixel-identical for any user without a
 *  picture, which is every user here. */
export default function InitialsAvatar({ name, size, className }: Props) {
  // Same rule as Cloud's getAvatarInitials.
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "?"
      : parts
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("");

  return (
    <span
      aria-hidden="true"
      className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden default-radius border border-gray-200 bg-gray-100 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <span
        className="font-semibold text-gray-300 select-none"
        style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}
      >
        {initials}
      </span>
    </span>
  );
}
