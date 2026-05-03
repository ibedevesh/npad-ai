import { Hono } from "hono";
import {
  newId,
  parseId,
  type Note,
  type SearchHit,
  type Visibility,
} from "@npad/core";
import { sql } from "./db.js";
import {
  bearerFromRequest,
  issueApiKey,
  upsertUserFromToken,
  userFromApiKey,
  verifyIdToken,
  type DbUser,
} from "./auth.js";
import { landing, login, dashboard, notePreview, notFound } from "./web.js";

type Row = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  tags: string[];
  visibility: Visibility;
  created_at: string | number;
  updated_at: string | number;
};

function rowToNote(r: Row): Note {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    tags: Array.isArray(r.tags) ? r.tags : [],
    visibility: r.visibility,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

function isVisibility(v: unknown): v is Visibility {
  return v === "private" || v === "unlisted" || v === "domain";
}

async function requireUser(req: Request): Promise<DbUser | null> {
  const tok = bearerFromRequest(req);
  if (!tok) return null;
  return await userFromApiKey(tok);
}

export const app = new Hono();

// ───────────────────────── Web pages ─────────────────────────
app.get("/", (c) => c.html(landing()));
app.get("/login", (c) => c.html(login()));
app.get("/dashboard", (c) => c.html(dashboard()));
app.get("/health", (c) => c.json({ ok: true }));
app.get("/api/version", (c) => c.json({ name: "npad", version: "0.2.0" }));

// Web view for /n/:id — title only + setup CTA, never the body.
app.get("/n/:id/view", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.html(notFound(), 404);
  const s = sql();
  const rows = (await s`SELECT id, title, visibility, updated_at FROM notes WHERE id = ${id}`) as Array<{
    id: string;
    title: string;
    visibility: Visibility;
    updated_at: number;
  }>;
  const row = rows[0];
  if (!row || row.visibility === "private") return c.html(notFound(), 404);
  return c.html(
    notePreview({
      id: row.id,
      title: row.title,
      visibility: row.visibility,
      updatedAt: Number(row.updated_at),
    }),
  );
});

// /n/:id is content-negotiated — JSON for API clients (Bearer key), HTML for browsers.
function isHtmlRequest(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html") && !req.headers.get("authorization");
}

// ───────────────────────── Auth ─────────────────────────

/** Exchange a Firebase ID token (from the web sign-in) for an npad API key. */
app.post("/api/auth/exchange", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.idToken !== "string") {
    return c.json({ error: "idToken required" }, 400);
  }
  let decoded;
  try {
    decoded = await verifyIdToken(body.idToken);
  } catch (e) {
    return c.json({ error: `invalid id token: ${e instanceof Error ? e.message : e}` }, 401);
  }
  if (!decoded.emailVerified) {
    return c.json({ error: "email not verified" }, 401);
  }
  const user = await upsertUserFromToken(decoded);
  const apiKey = await issueApiKey(user.id);
  return c.json({
    apiKey,
    user: {
      id: user.id,
      email: user.email,
      emailDomain: user.email_domain,
      name: user.name,
      avatarUrl: user.avatar_url,
    },
  });
});

/** Returns the current user (if Bearer key is valid). */
app.get("/api/me", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  return c.json({
    id: user.id,
    email: user.email,
    emailDomain: user.email_domain,
    name: user.name,
    avatarUrl: user.avatar_url,
  });
});

// ───────────────────────── Notes ─────────────────────────

// Create
app.post("/n", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || typeof body.body !== "string") {
    return c.json({ error: "title and body required" }, 400);
  }

  const id = newId();
  const now = Date.now();
  const tags: string[] = Array.isArray(body.tags) ? body.tags : [];
  const visibility: Visibility = isVisibility(body.visibility) ? body.visibility : "private";

  const s = sql();
  await s`
    INSERT INTO notes (id, owner_id, title, body, tags, visibility, created_at, updated_at)
    VALUES (${id}, ${user.id}, ${body.title}, ${body.body}, ${JSON.stringify(tags)}::jsonb,
            ${visibility}, ${now}, ${now})
  `;

  return c.json<Note>({
    id,
    title: body.title,
    body: body.body,
    tags,
    visibility,
    createdAt: now,
    updatedAt: now,
  });
});

// Read — visibility-aware. HTML browsers get redirected to the title-only view.
app.get("/n/:id", async (c) => {
  if (isHtmlRequest(c.req.raw)) {
    return c.redirect(`/n/${c.req.param("id")}/view`);
  }
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "invalid id" }, 400);

  const s = sql();
  const rows = (await s`SELECT * FROM notes WHERE id = ${id}`) as Row[];
  const row = rows[0];
  if (!row) return c.json({ error: "not found" }, 404);

  const requester = await requireUser(c.req.raw);
  const isOwner = requester?.id === row.owner_id;

  if (row.visibility === "private" && !isOwner) {
    return c.json({ error: "not found" }, 404);
  }
  if (row.visibility === "domain") {
    if (!requester) return c.json({ error: "unauthorized" }, 401);
    if (!isOwner) {
      const owner = (await s`SELECT email_domain FROM users WHERE id = ${row.owner_id}`) as Array<{ email_domain: string }>;
      if (!owner[0] || owner[0].email_domain !== requester.email_domain) {
        return c.json({ error: "not found" }, 404);
      }
    }
  }
  // unlisted or owner → fall through

  return c.json(rowToNote(row));
});

/** Public title-only fetch for the web /n/:id viewer (no body, no auth). */
app.get("/api/n/:id/preview", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "invalid id" }, 400);
  const s = sql();
  const rows = (await s`SELECT id, title, visibility, owner_id, updated_at FROM notes WHERE id = ${id}`) as Array<{
    id: string;
    title: string;
    visibility: Visibility;
    owner_id: string;
    updated_at: number;
  }>;
  const row = rows[0];
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.visibility === "private") return c.json({ error: "not found" }, 404);
  return c.json({
    id: row.id,
    title: row.title,
    visibility: row.visibility,
    updatedAt: Number(row.updated_at),
  });
});

// Append
app.patch("/n/:id", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "invalid id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.body !== "string") return c.json({ error: "body required" }, 400);

  const s = sql();
  const rows = (await s`SELECT * FROM notes WHERE id = ${id} AND owner_id = ${user.id}`) as Row[];
  const row = rows[0];
  if (!row) return c.json({ error: "not found" }, 404);

  const now = Date.now();
  const newBody = `${row.body}\n\n---\n${body.body}`;
  await s`UPDATE notes SET body = ${newBody}, updated_at = ${now} WHERE id = ${id}`;
  return c.json(rowToNote({ ...row, body: newBody, updated_at: now }));
});

// Update (replace fields)
app.put("/n/:id", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "invalid id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "json body required" }, 400);

  const s = sql();
  const rows = (await s`SELECT * FROM notes WHERE id = ${id} AND owner_id = ${user.id}`) as Row[];
  const row = rows[0];
  if (!row) return c.json({ error: "not found" }, 404);

  const now = Date.now();
  const newTitle = typeof body.title === "string" ? body.title : row.title;
  const newBody = typeof body.body === "string" ? body.body : row.body;
  const newTags = Array.isArray(body.tags) ? body.tags : Array.isArray(row.tags) ? row.tags : [];
  const newVis: Visibility = isVisibility(body.visibility) ? body.visibility : row.visibility;
  await s`
    UPDATE notes
    SET title = ${newTitle}, body = ${newBody}, tags = ${JSON.stringify(newTags)}::jsonb,
        visibility = ${newVis}, updated_at = ${now}
    WHERE id = ${id}
  `;
  return c.json(rowToNote({ ...row, title: newTitle, body: newBody, tags: newTags, visibility: newVis, updated_at: now }));
});

// List
app.get("/list", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20), 1), 200);
  const tag = c.req.query("tag");

  const s = sql();
  const rows = (await s`
    SELECT * FROM notes WHERE owner_id = ${user.id}
    ORDER BY updated_at DESC LIMIT ${tag ? limit * 4 : limit}
  `) as Row[];
  let notes = rows.map(rowToNote);
  if (tag) notes = notes.filter((n) => n.tags.includes(tag));
  return c.json(notes.slice(0, limit));
});

// Search
app.get("/search", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const q = c.req.query("q") ?? "";
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 10), 1), 50);
  if (!q.trim()) return c.json([]);

  const tsquery = q.trim().split(/\s+/).map((t) => t.replace(/[^a-z0-9]/gi, "")).filter(Boolean).join(" & ");
  const tagsParam = c.req.query("tags");
  const wantedTags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

  const s = sql();
  const rows = (await s`
    SELECT id, title, body, tags, updated_at,
           ts_rank(to_tsvector('english', title || ' ' || body),
                   to_tsquery('english', ${tsquery})) AS rank
    FROM notes
    WHERE owner_id = ${user.id}
      AND to_tsvector('english', title || ' ' || body) @@ to_tsquery('english', ${tsquery})
    ORDER BY rank DESC LIMIT ${limit}
  `) as Array<Row & { rank: number }>;

  let hits: SearchHit[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.body.slice(0, 200),
    tags: Array.isArray(r.tags) ? r.tags : [],
    updatedAt: Number(r.updated_at),
  }));
  if (wantedTags.length > 0) {
    const wanted = new Set(wantedTags);
    hits = hits.filter((h) => h.tags.some((t) => wanted.has(t)));
  }
  return c.json(hits);
});

// Fork (creates a copy in caller's vault from any non-private note)
app.post("/n/:id/fork", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "invalid id" }, 400);

  const s = sql();
  const rows = (await s`SELECT * FROM notes WHERE id = ${id}`) as Row[];
  const row = rows[0];
  if (!row) return c.json({ error: "not found" }, 404);

  // Visibility check identical to read.
  const isOwner = row.owner_id === user.id;
  if (row.visibility === "private" && !isOwner) return c.json({ error: "not found" }, 404);
  if (row.visibility === "domain" && !isOwner) {
    const owner = (await s`SELECT email_domain FROM users WHERE id = ${row.owner_id}`) as Array<{ email_domain: string }>;
    if (!owner[0] || owner[0].email_domain !== user.email_domain) {
      return c.json({ error: "not found" }, 404);
    }
  }

  const newId_ = newId();
  const now = Date.now();
  const newTitle = `${row.title} (fork)`;
  await s`
    INSERT INTO notes (id, owner_id, title, body, tags, visibility, created_at, updated_at)
    VALUES (${newId_}, ${user.id}, ${newTitle}, ${row.body},
            ${JSON.stringify(row.tags)}::jsonb, 'private', ${now}, ${now})
  `;
  return c.json<Note>({
    id: newId_,
    title: newTitle,
    body: row.body,
    tags: Array.isArray(row.tags) ? row.tags : [],
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  });
});

// Delete
app.delete("/n/:id", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "invalid id" }, 400);

  const s = sql();
  const result = (await s`DELETE FROM notes WHERE id = ${id} AND owner_id = ${user.id} RETURNING id`) as Array<{ id: string }>;
  if (result.length === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});
