import { Hono } from "hono";
import {
  newId,
  parseId,
  parseSlugId,
  slugify,
  type Note,
  type SearchHit,
  type Visibility,
} from "./core.js";
import { ImageResponse } from "@vercel/og";
import { sql } from "./db.js";

// Idempotent column-add migration, run once per cold start.
// Neon HTTP doesn't support multi-statement queries, so we run a single ALTER.
let _migratePromise: Promise<void> | null = null;
function ensureMigrated(): Promise<void> {
  if (!_migratePromise) {
    _migratePromise = (async () => {
      const s = sql();
      await s(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS seo_title text`);
    })().catch((e) => { _migratePromise = null; throw e; });
  }
  return _migratePromise;
}
import {
  bearerFromRequest,
  issueApiKey,
  upsertUserFromToken,
  userFromApiKey,
  verifyIdToken,
  type DbUser,
} from "./auth.js";
import { landing, login, dashboard, notePreview, notFound, deviceLinkPage, installPage, explorePage } from "./web.js";
import { FAVICON_PNG_B64 } from "./favicon.js";

type Row = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  tags: string[];
  visibility: Visibility;
  seo_title: string | null;
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
    seoTitle: r.seo_title || undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

function isVisibility(v: unknown): v is Visibility {
  return v === "private" || v === "unlisted" || v === "domain" || v === "public";
}

async function requireUser(req: Request): Promise<DbUser | null> {
  const tok = bearerFromRequest(req);
  if (!tok) return null;
  return await userFromApiKey(tok);
}

export const app = new Hono();

app.use("*", async (c, next) => {
  await ensureMigrated();
  await next();
});

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
  const rows = (await s`SELECT id, title, body, visibility, seo_title, updated_at FROM notes WHERE id = ${id}`) as Array<{
    id: string;
    title: string;
    body: string;
    visibility: Visibility;
    seo_title: string | null;
    updated_at: number;
  }>;
  const row = rows[0];
  if (!row || row.visibility === "private") return c.html(notFound(), 404);
  const slugSource = row.seo_title || row.title;
  const canonical = row.visibility === "public"
    ? `https://npad.run/p/${slugify(slugSource)}-${row.id}`
    : undefined;
  return c.html(
    notePreview({
      id: row.id,
      title: row.title,
      body: row.body,
      visibility: row.visibility,
      seoTitle: row.seo_title || undefined,
      updatedAt: Number(row.updated_at),
      canonical,
      indexable: false,
    }),
  );
});

// Public, indexable URL: /p/{slug}-{id}. Slug is decorative; id is the source of truth.
app.get("/p/:slugAndId", async (c) => {
  const id = parseSlugId(c.req.param("slugAndId"));
  if (!id) return c.html(notFound(), 404);
  const s = sql();
  const rows = (await s`SELECT id, title, body, visibility, seo_title, updated_at FROM notes WHERE id = ${id}`) as Array<{
    id: string;
    title: string;
    body: string;
    visibility: Visibility;
    seo_title: string | null;
    updated_at: number;
  }>;
  const row = rows[0];
  if (!row || row.visibility !== "public") return c.html(notFound(), 404);
  const slugSource = row.seo_title || row.title;
  const canonical = `https://npad.run/p/${slugify(slugSource)}-${row.id}`;
  return c.html(
    notePreview({
      id: row.id,
      title: row.title,
      body: row.body,
      visibility: row.visibility,
      seoTitle: row.seo_title || undefined,
      updatedAt: Number(row.updated_at),
      canonical,
      indexable: true,
    }),
  );
});

// Public discovery — latest public notes. Indexable.
app.get("/explore", async (c) => {
  const s = sql();
  const rows = (await s`
    SELECT id, title, body, seo_title, updated_at
    FROM notes
    WHERE visibility = 'public'
    ORDER BY updated_at DESC
    LIMIT 50
  `) as Array<{
    id: string;
    title: string;
    body: string;
    seo_title: string | null;
    updated_at: number;
  }>;
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    seoTitle: r.seo_title || undefined,
    snippet: r.body.replace(/\s+/g, " ").trim().slice(0, 200),
    updatedAt: Number(r.updated_at),
    url: `https://npad.run/p/${slugify(r.seo_title || r.title)}-${r.id}`,
  }));
  return c.html(explorePage(items));
});

// robots.txt — let crawlers find /p/ and /explore, keep /n/ private-by-link.
app.get("/robots.txt", (c) => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Allow: /p/",
    "Allow: /explore",
    "Disallow: /n/",
    "Disallow: /dashboard",
    "Disallow: /api/",
    "",
    "Sitemap: https://npad.run/sitemap.xml",
    "",
  ].join("\n");
  return c.text(body, 200, { "cache-control": "public, max-age=3600" });
});

// sitemap — only public notes are indexable.
app.get("/sitemap.xml", async (c) => {
  const s = sql();
  const rows = (await s`SELECT id, title, seo_title, updated_at FROM notes WHERE visibility = 'public' ORDER BY updated_at DESC LIMIT 5000`) as Array<{
    id: string;
    title: string;
    seo_title: string | null;
    updated_at: number;
  }>;
  const urls = [
    `<url><loc>https://npad.run/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `<url><loc>https://npad.run/explore</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `<url><loc>https://npad.run/install</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`,
  ];
  for (const r of rows) {
    const loc = `https://npad.run/p/${slugify(r.seo_title || r.title)}-${r.id}`;
    const lastmod = new Date(Number(r.updated_at)).toISOString();
    urls.push(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.join("") +
    `</urlset>`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
});

// Dynamic OG image for shareable cards (Twitter/X, Slack, Discord, LinkedIn).
app.get("/n/:id/og.png", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.text("not found", 404);
  const s = sql();
  const rows = (await s`SELECT title, seo_title, visibility FROM notes WHERE id = ${id}`) as Array<{
    title: string;
    seo_title: string | null;
    visibility: Visibility;
  }>;
  const row = rows[0];
  if (!row || row.visibility === "private") return c.text("not found", 404);

  const headline = row.seo_title || row.title;
  // Hard cap so the title can't blow out the layout, regardless of font size.
  const title = headline.length > 140 ? headline.slice(0, 137) + "…" : headline;
  // Scale font down as the title grows so long titles stay on 2–3 lines.
  const titleFontSize =
    title.length <= 40 ? 84 :
    title.length <= 70 ? 68 :
    title.length <= 100 ? 56 : 46;
  const badge = row.visibility === "public" ? "public note" : "shared note";

  return new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0b0b0d 0%, #16161a 100%)",
          color: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
        },
        children: [
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center", fontSize: 32, color: "#9ca3af", letterSpacing: "-0.5px" },
              children: [
                { type: "span", props: { style: { color: "#10b981", marginRight: 12 }, children: "●" } },
                { type: "span", props: { children: badge } },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: titleFontSize,
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: "-2px",
                color: "#ffffff",
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              },
              children: title,
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28, color: "#9ca3af" },
              children: [
                {
                  type: "div",
                  props: {
                    style: { display: "flex", alignItems: "center" },
                    children: [
                      { type: "span", props: { style: { color: "#ffffff", fontWeight: 700 }, children: "npad" } },
                      { type: "span", props: { style: { color: "#10b981" }, children: "." } },
                      { type: "span", props: { style: { color: "#ffffff", fontWeight: 700 }, children: "run" } },
                    ],
                  },
                },
                { type: "span", props: { children: "a notepad your agents share" } },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    },
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
  const seoTitle: string | null = typeof body.seoTitle === "string" && body.seoTitle.trim() ? body.seoTitle.trim().slice(0, 200) : null;

  const s = sql();
  await s`
    INSERT INTO notes (id, owner_id, title, body, tags, visibility, seo_title, created_at, updated_at)
    VALUES (${id}, ${user.id}, ${body.title}, ${body.body}, ${JSON.stringify(tags)}::jsonb,
            ${visibility}, ${seoTitle}, ${now}, ${now})
  `;

  return c.json<Note>({
    id,
    title: body.title,
    body: body.body,
    tags,
    visibility,
    seoTitle: seoTitle || undefined,
    createdAt: now,
    updatedAt: now,
  });
});

// Read — content-negotiates. Browsers (Accept: text/html + Mozilla UA) get the
// HTML viewer; agents/CLIs get JSON. Same URL works for humans and agents, so
// users only ever need to share `npad.run/n/:id`.
app.get("/n/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "invalid id" }, 400);

  const accept = c.req.header("accept") ?? "";
  const ua = c.req.header("user-agent") ?? "";
  const wantsHtml = accept.includes("text/html") && /Mozilla\//.test(ua);
  if (wantsHtml) {
    const s2 = sql();
    const rs = (await s2`SELECT id, title, body, visibility, seo_title, updated_at FROM notes WHERE id = ${id}`) as Array<{
      id: string; title: string; body: string; visibility: Visibility; seo_title: string | null; updated_at: number;
    }>;
    const r = rs[0];
    if (!r || r.visibility === "private") return c.html(notFound(), 404);
    const canonical = r.visibility === "public"
      ? `https://npad.run/p/${slugify(r.seo_title || r.title)}-${r.id}`
      : undefined;
    return c.html(notePreview({
      id: r.id, title: r.title, body: r.body, visibility: r.visibility,
      seoTitle: r.seo_title || undefined,
      updatedAt: Number(r.updated_at),
      canonical, indexable: false,
    }));
  }

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
  // Pass seoTitle: undefined to leave unchanged; pass "" or null to clear; pass a string to set.
  let newSeoTitle: string | null = row.seo_title ?? null;
  if (Object.prototype.hasOwnProperty.call(body, "seoTitle")) {
    if (typeof body.seoTitle === "string" && body.seoTitle.trim()) {
      newSeoTitle = body.seoTitle.trim().slice(0, 200);
    } else {
      newSeoTitle = null;
    }
  }
  await s`
    UPDATE notes
    SET title = ${newTitle}, body = ${newBody}, tags = ${JSON.stringify(newTags)}::jsonb,
        visibility = ${newVis}, seo_title = ${newSeoTitle}, updated_at = ${now}
    WHERE id = ${id}
  `;
  return c.json(rowToNote({ ...row, title: newTitle, body: newBody, tags: newTags, visibility: newVis, seo_title: newSeoTitle, updated_at: now }));
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
