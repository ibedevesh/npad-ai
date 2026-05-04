// Inlined subset of @npad/core needed by the deployed API.
// Local dev still uses the workspace package via packages/server/src.
import { customAlphabet } from "nanoid";

export type Visibility = "private" | "unlisted" | "domain";

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  visibility: Visibility;
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
