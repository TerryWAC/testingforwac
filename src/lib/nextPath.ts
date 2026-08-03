/**
 * Validate a post-login redirect target.
 *
 * Only same-origin absolute paths are allowed. Anything protocol-relative
 * ("//evil.com") or containing a scheme is rejected, so a crafted invite link
 * can't bounce a freshly signed-in user off to another site.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}
