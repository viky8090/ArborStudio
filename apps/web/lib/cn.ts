/**
 * Tailwind class merger.
 * Tiny implementation: tailwind-merge is a peer dep but the local variant
 * covers the common cases (concatenation + dedupe of conflicting utilities).
 */

export function cn(...args: Array<string | undefined | null | false>): string {
  return args.filter(Boolean).join(' ');
}
