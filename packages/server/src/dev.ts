import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { migrate } from "./db.js";

const port = Number(process.env.PORT ?? 8787);

async function main() {
  if (process.env.DATABASE_URL) {
    try {
      await migrate();
      console.error("[npad-server] migration ok");
    } catch (e) {
      console.error("[npad-server] migration failed:", e);
    }
  } else {
    console.error("[npad-server] DATABASE_URL not set — endpoints will 500 until configured");
  }
  serve({ fetch: app.fetch, port });
  console.error(`[npad-server] listening on http://localhost:${port}`);
}

main();
