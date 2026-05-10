import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _sql = neon(url);
  return _sql;
}

/** Idempotent schema. Run on every cold start (cheap). */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  google_sub    text UNIQUE NOT NULL,
  email         text NOT NULL,
  email_domain  text NOT NULL,
  name          text,
  avatar_url    text,
  created_at    bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_domain_idx ON users(email_domain);

CREATE TABLE IF NOT EXISTS api_keys (
  key_hash      text PRIMARY KEY,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         text,
  last_used_at  bigint,
  created_at    bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS notes (
  id          text PRIMARY KEY,
  owner_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  tags        jsonb NOT NULL DEFAULT '[]',
  visibility  text NOT NULL DEFAULT 'private',
  created_at  bigint NOT NULL,
  updated_at  bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_owner_idx ON notes(owner_id);
CREATE INDEX IF NOT EXISTS notes_visibility_idx ON notes(visibility);
CREATE INDEX IF NOT EXISTS notes_fts_idx ON notes
  USING gin(to_tsvector('english', title || ' ' || body));

ALTER TABLE notes ADD COLUMN IF NOT EXISTS seo_title text;

CREATE TABLE IF NOT EXISTS note_hits (
  id           bigserial PRIMARY KEY,
  note_id      text NOT NULL,
  surface      text NOT NULL,
  ua           text NOT NULL DEFAULT '',
  ua_category  text NOT NULL DEFAULT 'unknown',
  referer      text NOT NULL DEFAULT '',
  ip           text NOT NULL DEFAULT '',
  created_at   bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS note_hits_note_idx ON note_hits(note_id);
CREATE INDEX IF NOT EXISTS note_hits_category_idx ON note_hits(ua_category);
CREATE INDEX IF NOT EXISTS note_hits_created_idx ON note_hits(created_at DESC);
`;

export async function migrate() {
  const s = sql();
  await s(SCHEMA);
}
