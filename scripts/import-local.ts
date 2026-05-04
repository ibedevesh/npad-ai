// One-shot import: read every note from local SQLite and POST it to hosted npad.
// IDs will be NEW (server generates 10-char IDs); old 5-char local IDs are not preserved.
// Usage:
//   export NPAD_API_URL=https://npad-ai.vercel.app
//   export NPAD_API_KEY=npad_xxx
//   ./node_modules/.bin/tsx scripts/import-local.ts
//
// Re-running is safe — duplicates just get re-uploaded as new notes. Use --dry-run first.
import { homedir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../packages/mcp/src/stores/sqlite.js";

const dryRun = process.argv.includes("--dry-run");
const apiUrl = process.env.NPAD_API_URL;
const apiKey = process.env.NPAD_API_KEY;
const dbPath = process.env.NPAD_DB_PATH ?? join(homedir(), ".npad", "npad.db");

if (!apiUrl || !apiKey) {
  console.error("Set NPAD_API_URL and NPAD_API_KEY before running.");
  process.exit(1);
}

async function main() {
  const local = new SqliteStore(dbPath);
  const notes = await local.list({ limit: 1000 });
  console.log(`Found ${notes.length} local note(s) at ${dbPath}`);

  if (notes.length === 0) return;

  let ok = 0;
  let fail = 0;

  for (const note of notes) {
    const summary = `${note.id}  ${note.title.slice(0, 60)}`;
    if (dryRun) {
      console.log(`  [dry] would import: ${summary}`);
      continue;
    }

    try {
      const res = await fetch(`${apiUrl}/n`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          title: note.title,
          body: note.body,
          tags: note.tags,
          // Force private — hosted mode supports unlisted/domain too,
          // but we don't want to accidentally expose old notes.
          visibility: "private",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`  ✗ ${summary} — ${res.status} ${text.slice(0, 200)}`);
        fail++;
        continue;
      }
      const created = (await res.json()) as { id: string };
      console.log(`  ✓ ${summary}  →  ${created.id}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${summary} — ${e instanceof Error ? e.message : e}`);
      fail++;
    }
  }

  console.log("");
  console.log(`Imported: ${ok}  Failed: ${fail}  Local DB untouched at ${dbPath}.`);
  if (dryRun) console.log("(dry run — nothing was actually uploaded)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
