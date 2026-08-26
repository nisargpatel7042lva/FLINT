/**
 * "3m ago" / "5h ago" / "2d ago".
 *
 * Shared by the feed, the friends list and notifications. It was a private
 * copy inside the feed first; a second caller is exactly the point at which
 * two copies start disagreeing about what "just now" means.
 */
export const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.round(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
};
