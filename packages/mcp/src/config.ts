import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  chmodSync,
} from "node:fs";

export interface NpadConfig {
  apiKey: string;
  apiUrl?: string;
  user?: {
    id: string;
    email: string;
    emailDomain: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

export const DEFAULT_API_URL = "https://npad.run";

export function configPath(): string {
  return process.env.NPAD_CONFIG_PATH ?? join(homedir(), ".npad", "config.json");
}

export function readConfig(): NpadConfig | null {
  const p = configPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as NpadConfig;
  } catch {
    return null;
  }
}

export function writeConfig(cfg: NpadConfig): void {
  const p = configPath();
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2));
  // 0600 — only the user can read this; it contains an api key.
  try {
    chmodSync(p, 0o600);
  } catch {
    // chmod can fail on Windows; best-effort.
  }
}

export function clearConfig(): void {
  const p = configPath();
  if (existsSync(p)) unlinkSync(p);
}

/**
 * Resolves the API key + URL with this precedence:
 *   1. NPAD_API_KEY env var (override)
 *   2. ~/.npad/config.json (set by `npad login`)
 *   3. null (local SQLite mode)
 */
export function resolveAuth(): { apiKey: string | null; apiUrl: string } {
  if (process.env.NPAD_API_KEY) {
    return {
      apiKey: process.env.NPAD_API_KEY,
      apiUrl: process.env.NPAD_API_URL ?? DEFAULT_API_URL,
    };
  }
  const cfg = readConfig();
  return {
    apiKey: cfg?.apiKey ?? null,
    apiUrl: process.env.NPAD_API_URL ?? cfg?.apiUrl ?? DEFAULT_API_URL,
  };
}
