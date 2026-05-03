import { customAlphabet } from "nanoid";

// Lowercase alphanumerics excluding ambiguous chars (0/o, 1/l/i).
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
// 10 chars × ~31 alphabet ≈ 8e14 combinations — unguessable for unlisted URLs.
const nano = customAlphabet(ALPHABET, 10);
const nanoUser = customAlphabet(ALPHABET, 12);
const nanoKey = customAlphabet(ALPHABET, 32);

export function newId(): string {
  return nano();
}

export function newUserId(): string {
  return nanoUser();
}

/** Returns a fresh API key like "npad_<32 chars>". */
export function newApiKey(): string {
  return `npad_${nanoKey()}`;
}

/**
 * Accepts any of:
 *   "k7f2a"
 *   "npad.ai/n/k7f2a"
 *   "https://npad.ai/n/k7f2a"
 *   "http://localhost:8787/n/k7f2a"
 * Returns the bare id, or null if no valid id is found.
 */
export function parseId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/\/n\/([a-z0-9]{4,16})(?:[/?#].*)?$/i);
  if (urlMatch && urlMatch[1]) return urlMatch[1].toLowerCase();

  if (/^[a-z0-9]{4,16}$/i.test(trimmed)) return trimmed.toLowerCase();

  return null;
}

export function idToUrl(id: string, baseUrl = "https://npad.ai"): string {
  return `${baseUrl.replace(/\/$/, "")}/n/${id}`;
}
