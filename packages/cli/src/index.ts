#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { select, input, confirm as inqConfirm } from "@inquirer/prompts";
import { SqliteStore } from "@npad/mcp/sqlite-store";
import { HttpStore } from "@npad/mcp/http-store";
import { resolveAuth, writeConfig, clearConfig, readConfig, DEFAULT_API_URL } from "@npad/mcp/config";
import { idToUrl, parseId, type Store, type Note, type SearchHit } from "@npad/core";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { c, BANNER, timeAgo, trunc, pad, rule, symbol } from "./term.js";

const VERSION = "0.2.0";
const dbPath = process.env.NPAD_DB_PATH ?? join(homedir(), ".npad", "npad.db");

const auth = resolveAuth();
const store: Store = auth.apiKey
  ? new HttpStore(auth.apiUrl, auth.apiKey)
  : new SqliteStore(dbPath);
const storeMode = auth.apiKey ? `hosted (${auth.apiUrl})` : `local (${dbPath})`;

const args = process.argv.slice(2);
const cmd = args[0];

function flag(name: string): string | null {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return null;
  const v = args[i + 1];
  return v ?? null;
}

// ─── formatting helpers ────────────────────────────────────────────

function fmtListLine(n: { id: string; title: string; tags: string[]; updatedAt: number }): string {
  const id = c.cyan(pad(n.id, 6));
  const when = c.dim(pad(timeAgo(n.updatedAt), 9));
  const title = c.bold(trunc(n.title, 70));
  const tags = n.tags.length ? "  " + n.tags.map((t) => c.magenta(`#${t}`)).join(" ") : "";
  return `  ${id}  ${when}  ${title}${tags}`;
}

function printList(notes: Note[]) {
  if (notes.length === 0) {
    console.log(`  ${c.dim("(no notes)")}`);
    return;
  }
  console.log("");
  for (const n of notes) console.log(fmtListLine(n));
  console.log("");
  console.log(`  ${c.dim(`${notes.length} note${notes.length === 1 ? "" : "s"}`)}`);
  console.log("");
}

function printSearch(hits: SearchHit[]) {
  if (hits.length === 0) {
    console.log(`  ${c.dim("(no matches)")}`);
    return;
  }
  console.log("");
  for (const h of hits) {
    console.log(fmtListLine(h));
    const snippet = h.snippet
      .replace(/\s+/g, " ")
      .replace(/\[(.+?)\]/g, (_m, p) => c.yellow(c.bold(p)));
    console.log(`          ${c.dim(trunc(snippet, 100))}`);
  }
  console.log("");
  console.log(`  ${c.dim(`${hits.length} match${hits.length === 1 ? "" : "es"}`)}`);
  console.log("");
}

function printShow(note: Note) {
  console.log("");
  console.log(`  ${c.bold(note.title)}`);
  console.log(
    `  ${c.cyan(note.id)}  ${c.dim("·")}  ${c.dim(timeAgo(note.updatedAt))}  ${c.dim("·")}  ${c.dim(idToUrl(note.id, "local://npad"))}`,
  );
  if (note.tags.length) {
    console.log(`  ${note.tags.map((t) => c.magenta(`#${t}`)).join(" ")}`);
  }
  console.log("");
  console.log(rule(72));
  console.log("");
  console.log(note.body);
  console.log("");
  console.log(rule(72));
  console.log("");
}

interface EditorChoice {
  cmd: string;
  args: string[];
  /** True for GUI editors that block on tab-close — the friendly experience. */
  gui: boolean;
}

function detectEditor(): EditorChoice {
  // Honor explicit user choice first.
  const fromEnv = process.env.EDITOR ?? process.env.VISUAL;
  if (fromEnv) {
    const [cmd, ...args] = fromEnv.split(/\s+/);
    if (cmd) return { cmd, args, gui: /^(code|cursor|subl|mate|atom)$/.test(cmd) };
  }
  // Auto-detect: try friendly GUI editors first, fall back to terminal.
  const candidates: EditorChoice[] = [
    { cmd: "cursor", args: ["--wait"], gui: true },
    { cmd: "code", args: ["--wait"], gui: true },
    { cmd: "subl", args: ["--wait"], gui: true },
    { cmd: "nano", args: [], gui: false },
    { cmd: "vi", args: [], gui: false },
  ];
  for (const cand of candidates) {
    const which = spawnSync("which", [cand.cmd], { stdio: "pipe" });
    if (which.status === 0) return cand;
  }
  return { cmd: "vi", args: [], gui: false };
}

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const PALETTE_KEY = isMac ? "Cmd+Shift+P" : "Ctrl+Shift+P";
const SAVE_KEY = isMac ? "Cmd+S" : "Ctrl+S";
const CLOSE_TAB_KEY = isMac ? "Cmd+W" : "Ctrl+W";

function printEditorTip() {
  console.log("");
  console.log(`  ${symbol("warn")} ${c.yellow("no GUI editor detected on PATH — falling back to a terminal editor.")}`);
  console.log("");
  console.log(`  ${c.dim("for a friendlier experience, install one of these shell commands:")}`);
  console.log(
    `    ${c.bold("VS Code")}  ${c.dim("→ open VS Code,")} ${c.cyan(PALETTE_KEY)}${c.dim(", run")} ${c.cyan("Shell Command: Install 'code' command in PATH")}`,
  );
  console.log(
    `    ${c.bold("Cursor")}   ${c.dim("→ open Cursor,")} ${c.cyan(PALETTE_KEY)}${c.dim(", run")} ${c.cyan("Shell Command: Install 'cursor' command in PATH")}`,
  );
  console.log(`    ${c.bold("Sublime")}  ${c.dim("→ install the")} ${c.cyan("subl")} ${c.dim("CLI from Sublime's docs")}`);
  if (isWin) {
    console.log(
      `  ${c.dim("on Windows, you can also set")} ${c.cyan("$env:EDITOR='code --wait'")} ${c.dim("(PowerShell)")}`,
    );
  } else {
    console.log(`  ${c.dim("or set")} ${c.cyan("$EDITOR")} ${c.dim("explicitly, e.g.")} ${c.cyan("export EDITOR='nano'")}`);
  }
  console.log("");
}

function openEditor(initial: string): string {
  const dir = mkdtempSync(join(tmpdir(), "npad-"));
  const file = join(dir, "note.md");
  writeFileSync(file, initial);
  const choice = detectEditor();
  if (!choice.gui && !process.env.EDITOR && !process.env.VISUAL) {
    printEditorTip();
  }
  const hint = choice.gui
    ? `${c.dim("opening in")} ${c.cyan(choice.cmd)} ${c.dim(`— ${SAVE_KEY} to save, ${CLOSE_TAB_KEY} to close the tab`)}`
    : `${c.dim("opening in")} ${c.cyan(choice.cmd)} ${c.dim("— save and exit when done")}`;
  info(hint);
  const r = spawnSync(choice.cmd, [...choice.args, file], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`editor exited with ${r.status}`);
  return readFileSync(file, "utf8");
}

async function cmdDoctor() {
  console.log("");
  console.log(`  ${c.bold("npad doctor")}`);
  console.log("");
  const choice = detectEditor();
  const editorStatus = choice.gui ? c.green("GUI") : c.yellow("terminal");
  const cfg = readConfig();
  const mode = auth.apiKey ? c.green(`hosted (${auth.apiUrl})`) : c.dim("local (offline)");
  const who = cfg?.user?.email ? c.cyan(cfg.user.email) : c.dim("(not signed in)");
  console.log(`  mode:        ${mode}`);
  console.log(`  signed in:   ${who}`);
  console.log(`  api key:     ${auth.apiKey ? c.green(auth.apiKey.slice(0, 9) + "…") : c.dim("(none)")}`);
  console.log(`  db path:     ${c.cyan(dbPath)}`);
  console.log(`  editor:      ${c.cyan(choice.cmd)} ${c.dim(`(${editorStatus})`)}`);
  console.log(`  $EDITOR:     ${process.env.EDITOR ? c.cyan(process.env.EDITOR) : c.dim("(unset, auto-detected)")}`);
  console.log("");
  if (!choice.gui && !process.env.EDITOR) printEditorTip();
}

async function cmdLogin() {
  const apiUrl = process.env.NPAD_API_URL ?? DEFAULT_API_URL;
  const port = await findFreePort();
  console.log("");
  info(`opening ${c.cyan(`${apiUrl}/login`)} ${c.dim("in your browser…")}`);

  const result = await new Promise<{ apiKey: string; user: NonNullable<ReturnType<typeof readConfig>>["user"] }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("login timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    const server = createServer((req, res) => {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      };
      if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }
      if (req.url !== "/callback" || req.method !== "POST") {
        res.writeHead(404, corsHeaders);
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          res.writeHead(200, { "content-type": "application/json", ...corsHeaders });
          res.end(JSON.stringify({ ok: true }));
          clearTimeout(timeout);
          server.close();
          resolve(data);
        } catch (e) {
          res.writeHead(400, corsHeaders);
          res.end();
          clearTimeout(timeout);
          server.close();
          reject(e);
        }
      });
    });
    server.listen(port, "127.0.0.1");

    const url = `${apiUrl}/login?cli_port=${port}`;
    openInBrowser(url).catch(() => {
      info(c.dim(`if the browser didn't open, visit: ${url}`));
    });
  });

  if (!result.apiKey) {
    die("login failed: no api key returned");
  }

  writeConfig({
    apiKey: result.apiKey,
    apiUrl,
    user: result.user,
  });

  ok(`signed in as ${c.cyan(result.user?.email ?? "unknown")}`);
  info(c.dim(`api key saved to ${configPathHint()}`));
  info(c.dim("now wire your agent: ") + c.cyan("claude mcp add --scope user npad -- npx -y @npad/mcp"));
}

async function cmdLogout() {
  const cfg = readConfig();
  if (!cfg) {
    info(c.dim("not signed in"));
    return;
  }
  clearConfig();
  ok(`signed out ${c.dim(`(${cfg.user?.email ?? ""})`)}`);
}

function configPathHint(): string {
  return process.env.NPAD_CONFIG_PATH ?? join(homedir(), ".npad", "config.json");
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => {
        if (typeof addr === "object" && addr) resolve(addr.port);
        else reject(new Error("no port"));
      });
    });
    srv.on("error", reject);
  });
}

async function openInBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    if (process.platform === "darwin") cmd = `open "${url}"`;
    else if (process.platform === "win32") cmd = `start "" "${url}"`;
    else cmd = `xdg-open "${url}"`;
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

function splitTitleBody(text: string): { title: string; body: string } {
  const lines = text.split(/\r?\n/);
  let title = "";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.trim()) continue;
    const m = line.match(/^#\s+(.+)$/);
    if (m && m[1]) {
      title = m[1].trim();
      bodyStart = i + 1;
    } else {
      title = line.trim();
      bodyStart = i + 1;
    }
    break;
  }
  const body = lines.slice(bodyStart).join("\n").replace(/^\s+|\s+$/g, "");
  return { title, body };
}

function ok(msg: string) {
  console.log(`  ${symbol("ok")} ${msg}`);
}
function info(msg: string) {
  console.log(`  ${symbol("info")} ${msg}`);
}
function die(msg: string): never {
  console.error(`  ${symbol("err")} ${c.red(msg)}`);
  process.exit(1);
}

// ─── command handlers ──────────────────────────────────────────────

async function cmdList(opts: { tag?: string; limit?: number } = {}) {
  const notes = await store.list({ tag: opts.tag, limit: opts.limit ?? 20 });
  printList(notes);
}

async function cmdShow(id: string) {
  const note = await store.read(id);
  if (!note) {
    console.error(`  ${symbol("err")} ${c.red(`not found: ${id}`)}`);
    return;
  }
  printShow(note);
}

async function cmdSearch(query: string, opts: { tag?: string; limit?: number } = {}) {
  const hits = await store.search({
    query,
    tags: opts.tag ? [opts.tag] : undefined,
    limit: opts.limit ?? 20,
  });
  printSearch(hits);
}

async function cmdNew() {
  const template = `# Title here\n\n<!-- write the body in markdown -->\n`;
  const text = openEditor(template);
  const { title, body } = splitTitleBody(text);
  if (!title || !body) {
    info(c.dim("aborted: title or body empty"));
    return;
  }
  const note = await store.write({ title, body });
  ok(`saved  ${c.cyan(note.id)}  ${c.bold(note.title)}`);
}

async function cmdEdit(id: string) {
  const note = await store.read(id);
  if (!note) {
    console.error(`  ${symbol("err")} ${c.red(`not found: ${id}`)}`);
    return;
  }
  const initial = `# ${note.title}\n\n${note.body}\n`;
  const text = openEditor(initial);
  const { title, body } = splitTitleBody(text);
  if (!title || !body) {
    info(c.dim("aborted: title or body empty"));
    return;
  }
  const updated = await store.update({ id: note.id, title, body });
  if (!updated) {
    info(c.red("update failed"));
    return;
  }
  ok(`updated  ${c.cyan(updated.id)}  ${c.bold(updated.title)}`);
}

async function cmdRm(id: string) {
  const note = await store.read(id);
  if (!note) {
    console.error(`  ${symbol("err")} ${c.red(`not found: ${id}`)}`);
    return;
  }
  const yes = await inqConfirm({
    message: `Delete "${trunc(note.title, 60)}" (${note.id})? This cannot be undone.`,
    default: false,
  });
  if (!yes) {
    info(c.dim("cancelled"));
    return;
  }
  const parsed = parseId(note.id) ?? note.id;
  await store.delete(parsed);
  ok(`deleted  ${c.cyan(note.id)}`);
}

// ─── interactive mode ──────────────────────────────────────────────

async function pickNote(message: string): Promise<string | null> {
  const notes = await store.list({ limit: 50 });
  if (notes.length === 0) {
    info(c.dim("(no notes yet)"));
    return null;
  }
  return await select({
    message,
    pageSize: 12,
    choices: notes.map((n) => ({
      name: `${c.cyan(pad(n.id, 6))} ${c.dim(pad(timeAgo(n.updatedAt), 9))} ${trunc(n.title, 60)}`,
      value: n.id,
      description: n.tags.length ? n.tags.map((t) => `#${t}`).join(" ") : undefined,
    })),
  });
}

async function interactive() {
  console.log("");
  console.log(BANNER);
  console.log(`  ${c.dim("notepad for agents")}  ${c.dim("·")}  ${c.dim(`v${VERSION}`)}`);
  console.log("");

  while (true) {
    let action: string;
    try {
      action = await select({
        message: "what would you like to do?",
        pageSize: 10,
        choices: [
          { name: "📋  list recent notes", value: "list" },
          { name: "🔍  search", value: "search" },
          { name: "📖  read a note", value: "show" },
          { name: "✏️   write a new note", value: "new" },
          { name: "🛠   edit a note", value: "edit" },
          { name: "🗑   delete a note", value: "rm" },
          { name: "🔐  sign in", value: "login" },
          { name: "📁  show DB path", value: "path" },
          { name: "👋  quit", value: "quit" },
        ],
      });
    } catch {
      // user hit Ctrl-C / Esc
      console.log(`\n  ${c.dim("bye")}`);
      return;
    }

    try {
      switch (action) {
        case "list":
          await cmdList();
          break;
        case "search": {
          const q = await input({ message: "query:" });
          if (q.trim()) await cmdSearch(q.trim());
          break;
        }
        case "show": {
          const id = await pickNote("pick a note to read:");
          if (id) await cmdShow(id);
          break;
        }
        case "new":
          await cmdNew();
          break;
        case "edit": {
          const id = await pickNote("pick a note to edit:");
          if (id) await cmdEdit(id);
          break;
        }
        case "rm": {
          const id = await pickNote("pick a note to delete:");
          if (id) await cmdRm(id);
          break;
        }
        case "login":
          await cmdLogin();
          break;
        case "path":
          info(c.cyan(dbPath));
          info(c.dim(`mode: ${storeMode}`));
          break;
        case "quit":
          console.log(`  ${c.dim("bye")}`);
          return;
      }
    } catch (e) {
      // inquirer throws on Ctrl-C inside a prompt — treat as cancel, return to menu
      const msg = e instanceof Error ? e.message : String(e);
      if (!/User force closed/i.test(msg)) {
        console.error(`  ${symbol("err")} ${c.red(msg)}`);
      }
    }
  }
}

// ─── help (for `npad help` non-interactive) ────────────────────────

function printHelp() {
  console.log("");
  console.log(BANNER);
  console.log(`  ${c.dim("notepad for agents")}  ${c.dim("·")}  ${c.dim(`v${VERSION}`)}`);
  console.log("");
  console.log(`  ${c.bold("USAGE")}`);
  console.log(`    ${c.cyan("npad")}                       ${c.dim("interactive menu")}`);
  console.log(`    ${c.cyan("npad")} ${c.dim("<command> [args]")}      ${c.dim("direct command")}`);
  console.log("");
  console.log(`  ${c.bold("COMMANDS")}`);
  const cmds: Array<[string, string]> = [
    ["list", "list recent notes  " + c.dim("[--tag <t>] [--limit <n>]")],
    ["show <id>", "print a note"],
    ["search <q>", "keyword search  " + c.dim("[--tag <t>]")],
    ["new", "open " + c.dim("$EDITOR") + " for a new note"],
    ["edit <id>", "open " + c.dim("$EDITOR") + " to replace title + body"],
    ["rm <id>", "delete a note"],
    ["login", "sign in with Google (enables sync + sharing)"],
    ["logout", "remove saved api key"],
    ["path", "print DB path"],
    ["doctor", "diagnose env (mode, editor, api key)"],
    ["help", "show this help"],
  ];
  for (const [name, desc] of cmds) {
    console.log(`    ${pad(c.green(name), 22)} ${desc}`);
  }
  console.log("");
}

// ─── entrypoint ────────────────────────────────────────────────────

async function main() {
  switch (cmd) {
    case undefined:
      await interactive();
      return;
    case "help":
    case "-h":
    case "--help":
      printHelp();
      return;
    case "--version":
    case "-v":
      console.log(`npad ${VERSION}`);
      return;
    case "path":
      console.log(dbPath);
      return;
    case "list":
      await cmdList({
        tag: flag("tag") ?? undefined,
        limit: flag("limit") ? Number(flag("limit")) : undefined,
      });
      return;
    case "show": {
      const id = args[1];
      if (!id) die("usage: npad show <id>");
      await cmdShow(id);
      return;
    }
    case "search": {
      const q = args[1];
      if (!q) die("usage: npad search <query>");
      await cmdSearch(q, {
        tag: flag("tag") ?? undefined,
        limit: flag("limit") ? Number(flag("limit")) : undefined,
      });
      return;
    }
    case "new":
      await cmdNew();
      return;
    case "edit": {
      const id = args[1];
      if (!id) die("usage: npad edit <id>");
      await cmdEdit(id);
      return;
    }
    case "rm": {
      const id = args[1];
      if (!id) die("usage: npad rm <id>");
      await cmdRm(id);
      return;
    }
    case "doctor":
      await cmdDoctor();
      return;
    case "login":
      await cmdLogin();
      return;
    case "logout":
      await cmdLogout();
      return;
    default:
      die(`unknown command: ${cmd} — try ${c.cyan("npad help")}`);
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/User force closed/i.test(msg)) process.exit(0);
  console.error(`  ${symbol("err")} ${c.red(msg)}`);
  process.exit(1);
});
