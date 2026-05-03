const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;

function code(n: number): string {
  return isTTY ? `\x1b[${n}m` : "";
}

const RESET = code(0);

const wrap = (open: number, close = 0) => (s: string) =>
  isTTY ? `${code(open)}${s}${code(close === 0 ? 0 : close)}` : s;

export const c = {
  bold: wrap(1),
  dim: wrap(2),
  italic: wrap(3),
  underline: wrap(4),

  black: wrap(30),
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  magenta: wrap(35),
  cyan: wrap(36),
  white: wrap(37),
  gray: wrap(90),

  bgBlue: wrap(44),
  bgGreen: wrap(42),
  bgRed: wrap(41),
};

/** "5m ago", "2h ago", "3d ago", or YYYY-MM-DD for older. */
export function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

export function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function pad(s: string, n: number): string {
  // Pad based on visible length (strip ANSI for measurement).
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
  return s + " ".repeat(Math.max(0, n - visible.length));
}

export const BANNER = `${c.cyan(c.bold("  ███╗   ██╗██████╗  █████╗ ██████╗"))}
${c.cyan(c.bold("  ████╗  ██║██╔══██╗██╔══██╗██╔══██╗"))}
${c.cyan(c.bold("  ██╔██╗ ██║██████╔╝███████║██║  ██║"))}
${c.cyan(c.bold("  ██║╚██╗██║██╔═══╝ ██╔══██║██║  ██║"))}
${c.cyan(c.bold("  ██║ ╚████║██║     ██║  ██║██████╔╝"))}
${c.cyan(c.bold("  ╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝╚═════╝"))}`;

export function header(title: string): string {
  return `${c.bgBlue(c.bold(c.white(` ${title} `)))}`;
}

export function rule(width = 60): string {
  return c.dim("─".repeat(width));
}

export function symbol(kind: "ok" | "err" | "warn" | "info" | "prompt"): string {
  const map = {
    ok: c.green("✓"),
    err: c.red("✗"),
    warn: c.yellow("!"),
    info: c.blue("›"),
    prompt: c.magenta("?"),
  };
  return map[kind];
}
