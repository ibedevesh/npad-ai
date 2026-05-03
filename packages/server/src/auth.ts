import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { newUserId, newApiKey } from "@npad/core";
import { sql } from "./db.js";

let _app: App | null = null;

function adminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    return _app;
  }

  // Two ways to provide credentials:
  //   FIREBASE_SERVICE_ACCOUNT       — full JSON string (Vercel env var)
  //   FIREBASE_SERVICE_ACCOUNT_PATH  — file path (local dev)
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let serviceAccount: Record<string, unknown>;
  if (inline) {
    serviceAccount = JSON.parse(inline);
  } else if (path) {
    serviceAccount = JSON.parse(readFileSync(path, "utf8"));
  } else {
    throw new Error(
      "Firebase admin not configured: set FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_SERVICE_ACCOUNT_PATH (file)",
    );
  }

  _app = initializeApp({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    credential: cert(serviceAccount as any),
  });
  return _app;
}

export interface DecodedFirebaseToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
}

export async function verifyIdToken(idToken: string): Promise<DecodedFirebaseToken> {
  const decoded = await getAuth(adminApp()).verifyIdToken(idToken);
  if (!decoded.email) throw new Error("ID token missing email claim");
  return {
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: !!decoded.email_verified,
    name: typeof decoded.name === "string" ? decoded.name : null,
    picture: typeof decoded.picture === "string" ? decoded.picture : null,
  };
}

export interface DbUser {
  id: string;
  google_sub: string;
  email: string;
  email_domain: string;
  name: string | null;
  avatar_url: string | null;
  created_at: number;
}

export async function upsertUserFromToken(t: DecodedFirebaseToken): Promise<DbUser> {
  const s = sql();
  const now = Date.now();
  const domain = t.email.includes("@") ? t.email.split("@")[1]!.toLowerCase() : "";

  const existing = (await s`SELECT * FROM users WHERE google_sub = ${t.uid}`) as DbUser[];
  if (existing[0]) {
    await s`
      UPDATE users SET email = ${t.email}, email_domain = ${domain},
                       name = ${t.name}, avatar_url = ${t.picture}
      WHERE id = ${existing[0].id}
    `;
    return { ...existing[0], email: t.email, email_domain: domain, name: t.name ?? null, avatar_url: t.picture ?? null };
  }

  const id = newUserId();
  await s`
    INSERT INTO users (id, google_sub, email, email_domain, name, avatar_url, created_at)
    VALUES (${id}, ${t.uid}, ${t.email}, ${domain}, ${t.name}, ${t.picture}, ${now})
  `;
  return {
    id,
    google_sub: t.uid,
    email: t.email,
    email_domain: domain,
    name: t.name ?? null,
    avatar_url: t.picture ?? null,
    created_at: now,
  };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Issues a new API key for a user. Returns the plaintext (shown once). */
export async function issueApiKey(userId: string, label = "default"): Promise<string> {
  const plaintext = newApiKey();
  const keyHash = hashApiKey(plaintext);
  const now = Date.now();
  const s = sql();
  await s`
    INSERT INTO api_keys (key_hash, user_id, label, created_at)
    VALUES (${keyHash}, ${userId}, ${label}, ${now})
  `;
  return plaintext;
}

export async function userFromApiKey(apiKey: string): Promise<DbUser | null> {
  if (!apiKey || !apiKey.startsWith("npad_")) return null;
  const keyHash = hashApiKey(apiKey);
  const s = sql();
  const rows = (await s`
    SELECT u.* FROM api_keys k
    JOIN users u ON u.id = k.user_id
    WHERE k.key_hash = ${keyHash}
  `) as DbUser[];
  if (!rows[0]) return null;
  // Update last_used_at fire-and-forget (don't await on hot path)
  void s`UPDATE api_keys SET last_used_at = ${Date.now()} WHERE key_hash = ${keyHash}`;
  return rows[0];
}

export function bearerFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m && m[1] ? m[1].trim() : null;
}
