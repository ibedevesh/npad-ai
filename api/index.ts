// Vercel Functions entry — proxies all routes to the Hono app.
import { handle } from "hono/vercel";
import { app } from "../packages/server/src/app.js";
import { migrate } from "../packages/server/src/db.js";

// Run migrations once per cold start. Cheap, idempotent.
let migrated = false;
app.use(async (c, next) => {
  if (!migrated && process.env.DATABASE_URL) {
    try {
      await migrate();
      migrated = true;
    } catch (e) {
      console.error("[npad] migration failed:", e);
    }
  }
  await next();
});

export const config = { runtime: "nodejs" };
export default handle(app);
