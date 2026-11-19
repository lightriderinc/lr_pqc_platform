// Scans and server checks on this page run as server actions. Allow them up to
// a minute on the hosting platform; the scan itself is stopped after 50 seconds.
export const maxDuration = 60;

export default function QSearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}