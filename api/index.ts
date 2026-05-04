// Vercel Functions entry — named exports for each HTTP method.
import { app } from "./_lib/app.js";

export const config = { runtime: "nodejs" };

const fetch = (req: Request): Response | Promise<Response> => app.fetch(req);

export const GET = fetch;
export const POST = fetch;
export const PUT = fetch;
export const PATCH = fetch;
export const DELETE = fetch;
export const HEAD = fetch;
export const OPTIONS = fetch;
