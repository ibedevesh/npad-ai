// Inlined subset of @npad/core needed by the deployed API.
// Local dev still uses the workspace package via packages/server/src.
import { customAlphabet } from "nanoid";

export type Visibility = "private" | "unlisted" | "domain" | "public";

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  visibility: Visibility;
  /** Optional punchier headline used for SEO and the OG share card. */
  seoTitle?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  updatedAt: number;
}

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const nano = customAlphabet(ALPHABET, 10);
const nanoUser = customAlphabet(ALPHABET, 12);
const nanoKey = customAlphabet(ALPHABET, 32);

export function newId(): string {
  return nano();
}
export function newUserId(): string {
  return nanoUser();
}
export function newApiKey(): string {
  return `npad_${nanoKey()}`;
}

export function parseId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const m = trimmed.match(/\/n\/([a-z0-9]{4,16})(?:[/?#].*)?$/i);
  if (m && m[1]) return m[1].toLowerCase();
  if (/^[a-z0-9]{4,16}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function slugify(title: string): string {
  const s = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "note";
}

// Trailing id from `/p/{slug}-{id}` param; also accepts a bare id.
export function parseSlugId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  const m = trimmed.match(/-([a-z0-9]{4,16})$/);
  if (m && m[1]) return m[1];
  if (/^[a-z0-9]{4,16}$/.test(trimmed)) return trimmed;
  return null;
}
