// One-shot migration runner. Reads DATABASE_URL from .env.local (pulled via `vercel env pull`).
// Usage:  pnpm dlx tsx scripts/migrate.ts
//   or:   ./node_modules/.bin/tsx scripts/migrate.ts
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(path: string) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/i);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  } catch {
    // ignore
  }
}

loadEnvFile(join(process.cwd(), ".env.local"));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Run `vercel env pull .env.local` first.");
  process.exit(1);
}

const sql = neon(url);

const statements: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id            text PRIMARY KEY,
    google_sub    text UNIQUE NOT NULL,
    email         text NOT NULL,
    email_domain  text NOT NULL,
    name          text,
    avatar_url    text,
    created_at    bigint NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`,
  `CREATE INDEX IF NOT EXISTS users_domain_idx ON users(email_domain)`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    key_hash      text PRIMARY KEY,
    user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label         text,
    last_used_at  bigint,
    created_at    bigint NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id)`,
  `CREATE TABLE IF NOT EXISTS notes (
    id          text PRIMARY KEY,
    owner_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       text NOT NULL,
    body        text NOT NULL,
    tags        jsonb NOT NULL DEFAULT '[]',
    visibility  text NOT NULL DEFAULT 'private',
    created_at  bigint NOT NULL,
    updated_at  bigint NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS notes_owner_idx ON notes(owner_id)`,
  `CREATE INDEX IF NOT EXISTS notes_visibility_idx ON notes(visibility)`,
  `CREATE INDEX IF NOT EXISTS notes_fts_idx ON notes USING gin(to_tsvector('english', title || ' ' || body))`,
  `CREATE TABLE IF NOT EXISTS device_codes (
    code        text PRIMARY KEY,
    api_key     text,
    user_id     text REFERENCES users(id) ON DELETE CASCADE,
    created_at  bigint NOT NULL,
    expires_at  bigint NOT NULL,
    linked_at   bigint
  )`,
  `CREATE INDEX IF NOT EXISTS device_codes_expires_idx ON device_codes(expires_at)`,
];

async function main() {
  console.log(`Running ${statements.length} statements against Neon...`);
  for (const [i, stmt] of statements.entries()) {
    try {
      await sql(stmt);
      console.log(`  ✓ ${i + 1}/${statements.length}`);
    } catch (e) {
      console.error(`  ✗ ${i + 1}/${statements.length}:`, e instanceof Error ? e.message : e);
      throw e;
    }
  }
  console.log("Migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
