import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  newId,
  parseId,
  type Store,
  type Note,
  type SearchHit,
  type WriteInput,
  type AppendInput,
  type SearchInput,
  type UpdateInput,
  type ListInput,
} from "@npad/core";

interface Row {
  id: string;
  title: string;
  body: string;
  tags: string;
  visibility: "private" | "unlisted" | "domain";
  created_at: number;
  updated_at: number;
}

function rowToNote(r: Row): Note {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    tags: r.tags ? JSON.parse(r.tags) : [],
    visibility: r.visibility,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        tags        TEXT NOT NULL DEFAULT '[]',
        visibility  TEXT NOT NULL DEFAULT 'private',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title, body, tags,
        content='notes', content_rowid='rowid', tokenize='porter unicode61'
      );
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, body, tags)
        VALUES (new.rowid, new.title, new.body, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body, tags)
        VALUES ('delete', old.rowid, old.title, old.body, old.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body, tags)
        VALUES ('delete', old.rowid, old.title, old.body, old.tags);
        INSERT INTO notes_fts(rowid, title, body, tags)
        VALUES (new.rowid, new.title, new.body, new.tags);
      END;
    `);
  }

  async write(input: WriteInput): Promise<Note> {
    const now = Date.now();
    const id = newId();
    const tags = JSON.stringify(input.tags ?? []);
    const visibility = input.visibility ?? "private";
    this.db
      .prepare(
        `INSERT INTO notes (id, title, body, tags, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.title, input.body, tags, visibility, now, now);
    return {
      id,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      visibility,
      createdAt: now,
      updatedAt: now,
    };
  }

  async read(idOrUrl: string): Promise<Note | null> {
    const id = parseId(idOrUrl);
    if (!id) return null;
    const row = this.db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as Row | undefined;
    return row ? rowToNote(row) : null;
  }

  async append(input: AppendInput): Promise<Note | null> {
    const id = parseId(input.id);
    if (!id) return null;
    const existing = this.db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as Row | undefined;
    if (!existing) return null;
    const now = Date.now();
    const newBody = `${existing.body}\n\n---\n${input.body}`;
    this.db
      .prepare(`UPDATE notes SET body = ?, updated_at = ? WHERE id = ?`)
      .run(newBody, now, id);
    return rowToNote({ ...existing, body: newBody, updated_at: now });
  }

  async search(input: SearchInput): Promise<SearchHit[]> {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
    const query = input.query.trim();
    if (!query) return [];

    // Sanitize for FTS5: split into terms, escape, prefix-match each.
    const ftsQuery = query
      .split(/\s+/)
      .map((t) => `"${t.replace(/"/g, '""')}"*`)
      .join(" ");

    const rows = this.db
      .prepare(
        `SELECT n.id, n.title, n.tags, n.updated_at,
                snippet(notes_fts, 1, '[', ']', '…', 16) AS snippet
         FROM notes_fts
         JOIN notes n ON n.rowid = notes_fts.rowid
         WHERE notes_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(ftsQuery, limit) as Array<{
      id: string;
      title: string;
      tags: string;
      updated_at: number;
      snippet: string;
    }>;

    let hits: SearchHit[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      snippet: r.snippet,
      tags: r.tags ? JSON.parse(r.tags) : [],
      updatedAt: r.updated_at,
    }));

    if (input.tags && input.tags.length > 0) {
      const wanted = new Set(input.tags);
      hits = hits.filter((h) => h.tags.some((t) => wanted.has(t)));
    }

    return hits;
  }

  async update(input: UpdateInput): Promise<Note | null> {
    const id = parseId(input.id);
    if (!id) return null;
    const existing = this.db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as Row | undefined;
    if (!existing) return null;
    const now = Date.now();
    const newTitle = input.title ?? existing.title;
    const newBody = input.body ?? existing.body;
    const newTags = input.tags !== undefined ? JSON.stringify(input.tags) : existing.tags;
    const newVis = input.visibility ?? existing.visibility;
    this.db
      .prepare(
        `UPDATE notes SET title = ?, body = ?, tags = ?, visibility = ?, updated_at = ? WHERE id = ?`,
      )
      .run(newTitle, newBody, newTags, newVis, now, id);
    return rowToNote({
      ...existing,
      title: newTitle,
      body: newBody,
      tags: newTags,
      visibility: newVis,
      updated_at: now,
    });
  }

  async list(input: ListInput = {}): Promise<Note[]> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 200);
    const rows = this.db
      .prepare(`SELECT * FROM notes ORDER BY updated_at DESC LIMIT ?`)
      .all(limit * (input.tag ? 4 : 1)) as Row[];
    let notes = rows.map(rowToNote);
    if (input.tag) notes = notes.filter((n) => n.tags.includes(input.tag!));
    return notes.slice(0, limit);
  }

  async fork(idOrUrl: string): Promise<Note | null> {
    const original = await this.read(idOrUrl);
    if (!original) return null;
    return this.write({
      title: `${original.title} (fork)`,
      body: original.body,
      tags: original.tags,
      visibility: "private",
    });
  }

  async delete(id: string): Promise<boolean> {
    const parsed = parseId(id);
    if (!parsed) return false;
    const result = this.db.prepare(`DELETE FROM notes WHERE id = ?`).run(parsed);
    return result.changes > 0;
  }
}
