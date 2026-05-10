import { sql } from "./db.js";

// Classify a User-Agent string into a coarse category so we can answer
// "which agent is fetching our links". Order matters — most specific first.
const AGENT_PATTERNS: Array<[string, RegExp]> = [
  ["ChatGPT-User", /ChatGPT-User/i],
  ["OAI-SearchBot", /OAI-SearchBot/i],
  ["GPTBot", /GPTBot/i],
  ["ClaudeBot", /ClaudeBot/i],
  ["Claude-User", /Claude-User/i],
  ["Claude-SearchBot", /Claude-SearchBot/i],
  ["anthropic-ai", /anthropic-ai/i],
  ["PerplexityBot", /PerplexityBot/i],
  ["Perplexity-User", /Perplexity-User/i],
  ["Google-Extended", /Google-Extended/i],
  ["GoogleOther", /GoogleOther/i],
  ["Googlebot", /Googlebot/i],
  ["Bingbot", /bingbot/i],
  ["Bytespider", /Bytespider/i],
  ["Meta-ExternalAgent", /Meta-ExternalAgent/i],
  ["Meta-ExternalFetcher", /Meta-ExternalFetcher/i],
  ["Applebot-Extended", /Applebot-Extended/i],
  ["Applebot", /Applebot/i],
  ["cohere-ai", /cohere-ai/i],
  ["YouBot", /YouBot/i],
  ["DuckAssistBot", /DuckAssistBot/i],
  ["Diffbot", /Diffbot/i],
  ["Amazonbot", /Amazonbot/i],
  ["facebookexternalhit", /facebookexternalhit/i],
  ["Twitterbot", /Twitterbot/i],
  ["Slackbot", /Slackbot/i],
  ["Discordbot", /Discordbot/i],
  ["curl", /^curl\//i],
  ["wget", /^Wget\//i],
  ["node-fetch", /node-fetch/i],
  ["axios", /axios/i],
  ["python-requests", /python-requests/i],
  ["httpx", /python-httpx|httpx/i],
];

export function classifyUA(ua: string): string {
  if (!ua) return "unknown";
  for (const [name, re] of AGENT_PATTERNS) if (re.test(ua)) return name;
  if (/Mozilla\//.test(ua)) return "browser";
  return "other";
}

export type HitSurface = "n" | "p";

export function recordHit(opts: {
  surface: HitSurface;
  noteId: string;
  ua: string;
  referer: string;
  ip: string;
}): void {
  const ts = Date.now();
  const category = classifyUA(opts.ua);
  // Fire-and-forget — must never block or fail the request.
  void (async () => {
    try {
      const s = sql();
      await s`
        INSERT INTO note_hits (note_id, surface, ua, ua_category, referer, ip, created_at)
        VALUES (${opts.noteId}, ${opts.surface}, ${opts.ua.slice(0, 500)},
                ${category}, ${opts.referer.slice(0, 500)}, ${opts.ip.slice(0, 64)}, ${ts})
      `;
    } catch {
      // swallow — analytics must never break reads
    }
  })();
}

export function clientIp(headers: Headers): string {
  const xf = headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "";
}
