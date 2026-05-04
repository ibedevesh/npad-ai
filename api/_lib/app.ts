import { Hono } from "hono";
import {
  newId,
  parseId,
  type Note,
  type SearchHit,
  type Visibility,
} from "./core.js";
import { sql } from "./db.js";
import {
  bearerFromRequest,
  issueApiKey,
  upsertUserFromToken,
  userFromApiKey,
  verifyIdToken,
  type DbUser,
} from "./auth.js";
import { landing, login, dashboard, notePreview, notFound, deviceLinkPage, installPage } from "./web.js";
import { FAVICON_PNG_B64 } from "./favicon.js";

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

app.get("/", (c) => c.html(landing()));
app.get("/install", (c) => c.html(installPage()));
app.get("/login", (c) => c.html(login()));
app.get("/dashboard", (c) => c.html(dashboard()));
app.get("/health", (c) => c.json({ ok: true }));
app.get("/api/version", (c) => c.json({ name: "npad", version: "0.2.0" }));
app.get("/favicon.png", (c) => {
  const bytes = Uint8Array.from(atob(FAVICON_PNG_B64), (ch) => ch.charCodeAt(0));
  return new Response(bytes, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" },
  });
});
app.get("/favicon.ico", (c) => c.redirect("/favicon.png", 301)); // eslint-disable-line @typescript-eslint/no-unused-vars

app.get("/n/:id/view", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.html(notFound(), 404);
  const s = sql();
  const rows = (await s`SELECT id, title, body, visibility, updated_at FROM notes WHERE id = ${id}`) as Array<{
    id: string;
    title: string;
    body: string;
    visibility: Visibility;
    updated_at: number;
  }>;
  const row = rows[0];
  if (!row || row.visibility === "private") return c.html(notFound(), 404);
  return c.html(
    notePreview({
      id: row.id,
      title: row.title,
      body: row.body,
      visibility: row.visibility,
      updatedAt: Number(row.updated_at),
    }),
  );
});

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

const DEVICE_CODE_TTL_MS = 30 * 60 * 1000;

function newDeviceCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick()}-${pick()}`;
}

app.post("/api/auth/device/start", async (c) => {
  const code = newDeviceCode();
  const now = Date.now();
  const expires = now + DEVICE_CODE_TTL_MS;
  const s = sql();
  await s`
    INSERT INTO device_codes (code, created_at, expires_at)
    VALUES (${code}, ${now}, ${expires})
  `;
  const host = c.req.header("host") ?? "npad.run";
  const proto = c.req.header("x-forwarded-proto") ?? "https";
  return c.json({
    code,
    verifyUrl: `${proto}://${host}/cli/${code}`,
    expiresAt: expires,
  });
});

app.post("/api/auth/device/link", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.code !== "string" || typeof body.idToken !== "string") {
    return c.json({ error: "code and idToken required" }, 400);
  }
  const s = sql();
  const now = Date.now();
  const rows = (await s`SELECT * FROM device_codes WHERE code = ${body.code}`) as Array<{
    code: string;
    api_key: string | null;
    user_id: string | null;
    expires_at: string | number;
    linked_at: string | number | null;
  }>;
  const row = rows[0];
  if (!row) return c.json({ error: "code not found" }, 404);
  if (Number(row.expires_at) < now) return c.json({ error: "code expired" }, 410);
  if (row.linked_at) return c.json({ error: "code already used" }, 409);

  let decoded;
  try {
    decoded = await verifyIdToken(body.idToken);
  } catch (e) {
    return c.json({ error: `invalid id token: ${e instanceof Error ? e.message : e}` }, 401);
  }
  if (!decoded.emailVerified) return c.json({ error: "email not verified" }, 401);

  const user = await upsertUserFromToken(decoded);
  const apiKey = await issueApiKey(user.id, "cli");
  await s`
    UPDATE device_codes
    SET api_key = ${apiKey}, user_id = ${user.id}, linked_at = ${now}
    WHERE code = ${body.code}
  `;
  return c.json({ ok: true, email: user.email });
});

app.get("/api/auth/device/poll", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "code required" }, 400);
  const s = sql();
  const now = Date.now();
  const rows = (await s`SELECT * FROM device_codes WHERE code = ${code}`) as Array<{
    code: string;
    api_key: string | null;
    user_id: string | null;
    expires_at: string | number;
    linked_at: string | number | null;
  }>;
  const row = rows[0];
  if (!row) return c.json({ error: "code not found" }, 404);
  if (Number(row.expires_at) < now) {
    await s`DELETE FROM device_codes WHERE code = ${code}`;
    return c.json({ error: "code expired" }, 410);
  }
  if (!row.api_key) return c.json({ pending: true });
  const apiKey = row.api_key;
  const userRows = (await s`SELECT id, email, email_domain, name, avatar_url FROM users WHERE id = ${row.user_id!}`) as Array<{
    id: string;
    email: string;
    email_domain: string;
    name: string | null;
    avatar_url: string | null;
  }>;
  await s`DELETE FROM device_codes WHERE code = ${code}`;
  const u = userRows[0];
  return c.json({
    apiKey,
    user: u
      ? { id: u.id, email: u.email, emailDomain: u.email_domain, name: u.name, avatarUrl: u.avatar_url }
      : null,
  });
});

app.get("/cli/:code", async (c) => {
  const code = c.req.param("code");
  return c.html(deviceLinkPage(code));
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

// Read — always returns JSON. The HTML viewer lives at /n/:id/view and is what
// the landing page / dashboard link to for browsers. Agents fetching /n/:id
// always get structured JSON (note body if authorized, setup hint otherwise).
app.get("/n/:id", async (c) => {
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
    if (!requester) return c.json(setupHint(row.id, row.title));
    if (!isOwner) {
      const owner = (await s`SELECT email_domain FROM users WHERE id = ${row.owner_id}`) as Array<{ email_domain: string }>;
      if (!owner[0] || owner[0].email_domain !== requester.email_domain) {
        return c.json({ error: "not found" }, 404);
      }
    }
  }
  // unlisted = anyone with the URL can read (like a Gist or Loom link). No auth needed.
  // For anonymous reads we PREPEND a clear "How you got this" section so any agent
  // summarizing the note for the user surfaces the install path naturally.
  if (row.visibility === "unlisted" && !requester) {
    const note = rowToNote(row);
    const banner =
      "## How you're reading this\n\n" +
      "This note is hosted on **npad** — a shared notepad for AI agents. " +
      "Anyone with the URL can read it. To save and read your own notes through your agent, install npad in 3 commands:\n\n" +
      "```bash\n" +
      "npm i -g @npad/cli\n" +
      "npad login\n" +
      "claude mcp add --scope user npad -- npx -y @npad/mcp\n" +
      "```\n\n" +
      "Full install guide: https://npad.run/install\n\n" +
      "---\n\n" +
      "## Note content\n\n";
    return c.json({ ...note, body: banner + note.body });
  }

  return c.json(rowToNote(row));
});

/**
 * Returned when an agent (or any unauthenticated client) fetches /n/:id for an
 * unlisted/domain note. Tells the agent how to install npad so it can read the body.
 * Includes structured fields plus a `message` written for AI agents.
 */
function setupHint(id: string, title: string) {
  return {
    error: "npad_auth_required",
    note: { id, title, url: `https://npad.run/n/${id}` },
    message:
      "This URL points to a note on npad — a shared scratchpad for AI agents. " +
      "To read the body, the user needs npad installed and an API key. Guide them through these steps:\n" +
      "1. Visit https://npad.run and sign in with Google to create an account and get an API key.\n" +
      "2. Install the CLI:  npm i -g @npad/cli\n" +
      "3. Save the key:     npad login    (opens browser, completes device-flow auth, writes ~/.npad/config.json)\n" +
      "4. Wire up the MCP server:  claude mcp add --scope user npad -- npx -y @npad/mcp\n" +
      "5. Restart the agent. It will then have 6 tools (note_write/read/append/search/fork/delete) and can fetch this URL directly.\n" +
      "After setup, retry note_read on this URL to get the full body.",
    setup: {
      signupUrl: "https://npad.run",
      installCli: "npm i -g @npad/cli",
      login: "npad login",
      mcpAdd: "claude mcp add --scope user npad -- npx -y @npad/mcp",
      docs: "https://github.com/ibedevesh/npad-ai",
    },
  };
}

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
