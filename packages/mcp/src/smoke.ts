import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";
import { SqliteStore } from "./stores/sqlite.js";

async function main() {
  const dbPath = join(tmpdir(), `npad-smoke-${Date.now()}.db`);
  const store = new SqliteStore(dbPath);

  console.log("→ write");
  const a = await store.write({
    title: "k8s portforward Dumbledore in atlys cluster",
    body: "kubectl port-forward svc/dumbledore 5432:5432 -n wizards",
    tags: ["k8s", "atlys"],
  });
  console.log("  id:", a.id);

  const b = await store.write({
    title: "Stripe webhook retries",
    body: "make handler idempotent via event.id dedupe",
    tags: ["stripe", "payments"],
  });
  console.log("  id:", b.id);

  console.log("→ read by id");
  const r1 = await store.read(a.id);
  console.log("  title:", r1?.title);

  console.log("→ read by URL");
  const r2 = await store.read(`https://npad.run/n/${a.id}`);
  console.log("  title:", r2?.title);

  console.log("→ search 'dumbledore'");
  const s1 = await store.search({ query: "dumbledore" });
  console.log("  hits:", s1.length, s1[0]?.title);

  console.log("→ search 'stripe webhook'");
  const s2 = await store.search({ query: "stripe webhook" });
  console.log("  hits:", s2.length, s2[0]?.title);

  console.log("→ append");
  const apnd = await store.append({ id: a.id, body: "also requires VPN connected first" });
  console.log("  body length:", apnd?.body.length);

  console.log("→ fork");
  const fk = await store.fork(a.id);
  console.log("  forked title:", fk?.title);

  console.log("→ delete");
  const del = await store.delete(b.id);
  console.log("  deleted:", del);

  console.log("→ search after delete");
  const s3 = await store.search({ query: "stripe" });
  console.log("  hits:", s3.length);

  if (existsSync(dbPath)) unlinkSync(dbPath);
  console.log("✓ smoke ok");
}

main().catch((e) => {
  console.error("✗ smoke failed:", e);
  process.exit(1);
});
