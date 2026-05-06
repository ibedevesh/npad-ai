/**
 * Server-rendered HTML pages — no React, no client framework.
 * Just template literals + a tiny embedded Firebase JS SDK for sign-in.
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBYClcrmzDnNlBk2KgHbQwL4bspiCCnbTU",
  authDomain: "npad.run",
  projectId: "npad-ffae2",
  storageBucket: "npad-ffae2.firebasestorage.app",
  messagingSenderId: "250385425072",
  appId: "1:250385425072:web:ee9d57ea769fc76ee49175",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');
:root {
  --bg: #07070A;
  --fg: #F4F4F5;
  --muted: #71717A;
  --dim: #52525B;
  --accent: #F5A524;
  --accent-soft: rgba(245,165,36,0.10);
  --accent-glow: 0 0 16px rgba(245,165,36,0.14);
  --border: #1A1A1F;
  --border-strong: #26262C;
  --card: #0E0E12;
  --card-2: #111116;
  --danger: #FB7185;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  display: flex; flex-direction: column;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,165,36,0.05), transparent 60%),
    radial-gradient(ellipse 60% 40% at 90% 100%, rgba(120,80,255,0.04), transparent 60%);
  background-attachment: fixed;
}
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, black 50%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, black 50%, transparent 100%);
}
header, main, footer { position: relative; z-index: 1; }
header {
  padding: 18px 28px;
  border-bottom: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
  backdrop-filter: blur(8px);
  background: rgba(7,7,10,0.6);
  position: sticky; top: 0; z-index: 10;
}
header .brand {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-weight: 600; font-size: 15px;
  color: var(--fg); letter-spacing: -0.2px;
  display: inline-flex; align-items: baseline; gap: 2px;
}
header .brand .dot { color: var(--accent); }
header .brand .caret {
  display: inline-block; width: 8px; height: 14px;
  background: var(--accent); margin-left: 4px; transform: translateY(2px);
  animation: blink 1.2s steps(2, start) infinite;
  box-shadow: var(--accent-glow);
}
@keyframes blink { 50% { opacity: 0; } }
header nav { display: flex; align-items: center; gap: 22px; }
header nav a {
  color: var(--muted); text-decoration: none; font-size: 13.5px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  transition: color 120ms ease;
}
header nav a:hover { color: var(--fg); }
main { flex: 1; max-width: 760px; margin: 0 auto; padding: 64px 24px 48px; width: 100%; }
main.wide { max-width: 880px; }
.note-meta { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; color: var(--muted); font-family: 'Geist Mono', monospace; font-size: 12px; letter-spacing: 0.5px; margin-bottom: 18px; }
.note-meta .dot-sep { color: var(--dim); }
.note-title { font-size: 40px; line-height: 1.1; letter-spacing: -1.4px; margin: 0 0 28px; font-weight: 600; }
.note-body { font-size: 15.5px; line-height: 1.75; color: #D4D4D8; }
.note-body h1, .note-body h2, .note-body h3 { color: var(--fg); letter-spacing: -0.5px; margin: 32px 0 12px; font-weight: 600; text-transform: none; }
.note-body h1 { font-size: 28px; }
.note-body h1::before { display: none; }
.note-body h2 { font-size: 22px; font-family: inherit; color: var(--fg); text-transform: none; letter-spacing: -0.3px; }
.note-body h2::before { display: none; }
.note-body h3 { font-size: 17px; }
.note-body p { color: #C8C8CE; margin: 0 0 14px; }
.note-body ul, .note-body ol { padding-left: 22px; margin: 0 0 16px; color: #C8C8CE; }
.note-body li { margin: 4px 0; }
.note-body a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(245,165,36,0.4); }
.note-body strong { color: var(--fg); font-weight: 600; }
.note-body em { color: #E4E4E7; }
.note-body hr { border: 0; height: 1px; background: var(--border-strong); margin: 28px 0; }
.note-body blockquote { border-left: 2px solid var(--accent); margin: 16px 0; padding: 4px 0 4px 16px; color: var(--muted); font-style: italic; }
.note-body pre { background: #030305; padding: 16px 18px; border-radius: 8px; user-select: text; }
.note-body pre::before { content: ''; margin: 0; }
.note-body :not(pre) > code { font-size: 13px; }
.share-bar {
  margin-top: 40px; padding: 18px 20px; border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--card), var(--card-2));
  border-radius: 10px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;
}
.share-bar .label { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px; }
.share-bar .url { font-family: 'Geist Mono', monospace; font-size: 13px; color: var(--fg); user-select: all; }
.share-bar .actions { display: flex; gap: 8px; }
.toggle-row { display: flex; gap: 6px; margin: 18px 0 14px; }
.toggle-row button {
  background: transparent; border: 1px solid var(--border-strong); color: var(--muted);
  padding: 6px 14px; font-size: 12px; border-radius: 6px;
  font-family: 'Geist Mono', monospace; text-transform: uppercase; letter-spacing: 0.5px;
}
.toggle-row button.active { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.toggle-row button:hover { transform: none; box-shadow: none; }
.raw-note {
  border: 1px solid var(--border-strong); border-radius: 12px; overflow: hidden;
  background: #030305; margin: 8px 0 28px;
}
.raw-note-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px; border-bottom: 1px solid var(--border);
  font-family: 'Geist Mono', monospace; font-size: 11.5px;
  text-transform: uppercase; letter-spacing: 1.2px;
  color: var(--muted); background: rgba(255,255,255,0.015);
}
.raw-note-head span:first-child { color: var(--accent); }
.raw-note-meta { color: var(--dim); }
.raw-note-body {
  margin: 0; border: 0; border-radius: 0; background: transparent;
  padding: 22px 24px; max-height: 720px; overflow: auto;
  white-space: pre-wrap; word-wrap: break-word;
  user-select: none; -webkit-user-select: none;
  font-size: 13.5px; line-height: 1.7; color: #D4D4D8;
}
.raw-note-body::before { content: ''; margin: 0; }
.login-wrap {
  min-height: calc(100vh - 180px);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 16px;
}
.login-card {
  width: 100%; max-width: 440px;
  background: linear-gradient(180deg, var(--card) 0%, var(--card-2) 100%);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 40px 36px 32px;
  position: relative;
  box-shadow:
    0 0 0 1px rgba(245,165,36,0.04),
    0 24px 60px rgba(0,0,0,0.6),
    0 0 80px rgba(245,165,36,0.06);
}
.login-card::before {
  content: ''; position: absolute; inset: -1px;
  border-radius: 16px; padding: 1px; pointer-events: none;
  background: linear-gradient(180deg, rgba(245,165,36,0.25), transparent 40%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.login-mark {
  display: flex; align-items: baseline; justify-content: center; gap: 2px;
  margin-bottom: 6px;
}
.login-mark-text {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 24px; font-weight: 600; letter-spacing: -0.5px; color: var(--fg);
}
.login-eyebrow {
  text-align: center; font-family: 'Geist Mono', monospace;
  font-size: 11px; color: var(--muted); letter-spacing: 2px;
  text-transform: uppercase; margin-bottom: 32px;
}
.login-title {
  font-size: 28px; letter-spacing: -0.8px; margin: 0 0 10px;
  text-align: center; font-weight: 600;
}
.login-sub {
  text-align: center; color: var(--muted);
  font-size: 14px; line-height: 1.6; margin: 0 0 28px;
}
.login-btn {
  width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  background: var(--fg); color: #07070A;
  padding: 13px 18px; font-size: 14.5px; font-weight: 500;
  border: 0; border-radius: 10px; cursor: pointer;
  font-family: inherit; letter-spacing: -0.1px;
  transition: transform 120ms ease, box-shadow 200ms ease;
}
.login-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(255,255,255,0.08); }
.login-btn svg { flex-shrink: 0; }
.login-divider {
  display: flex; align-items: center; gap: 12px;
  margin: 24px 0 20px; color: var(--dim);
  font-family: 'Geist Mono', monospace; font-size: 11px;
  text-transform: uppercase; letter-spacing: 2px;
}
.login-divider::before, .login-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}
.login-cli-label {
  font-family: 'Geist Mono', monospace; font-size: 11px;
  color: var(--muted); letter-spacing: 1.2px;
  text-transform: uppercase; margin-bottom: 8px; text-align: center;
}
.login-cli pre { margin: 0; }
.login-foot {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 8px 12px; margin-top: 28px; padding-top: 22px;
  border-top: 1px solid var(--border);
  font-family: 'Geist Mono', monospace; font-size: 11px;
  color: var(--dim); letter-spacing: 0.8px; text-transform: uppercase;
}
.login-foot span:first-child { color: var(--accent); }
.login-terms {
  margin-top: 20px; font-size: 12.5px; text-align: center;
}
h1 {
  font-size: 44px; line-height: 1.08; margin: 0 0 18px;
  letter-spacing: -1.2px; font-weight: 600; color: var(--fg);
}
h2 {
  font-size: 13px; margin: 44px 0 14px; color: var(--muted);
  text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;
  font-family: 'Geist Mono', ui-monospace, monospace;
  display: flex; align-items: center; gap: 10px;
}
h2::before {
  content: ''; width: 6px; height: 6px; background: var(--accent);
  border-radius: 50%; box-shadow: var(--accent-glow);
}
p { color: #A1A1AA; margin: 0 0 16px; }
p.muted, .muted { color: var(--muted); }
a { color: var(--accent); text-decoration: none; transition: opacity 120ms; }
a:hover { opacity: 0.8; }
button, .btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--fg); color: #07070A; border: 0;
  padding: 11px 20px; font-weight: 500; font-size: 14px;
  border-radius: 8px; cursor: pointer; font-family: inherit;
  letter-spacing: -0.1px; transition: transform 120ms ease, box-shadow 200ms ease, background 200ms;
}
button:hover, .btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(255,255,255,0.06); }
button:active, .btn:active { transform: translateY(0); }
button.primary, .btn.primary {
  background: var(--accent); color: #04150E;
  box-shadow: var(--accent-glow);
}
button.primary:hover, .btn.primary:hover {
  box-shadow: 0 0 24px rgba(94,234,212,0.22);
}
button.secondary, .btn.secondary {
  background: transparent; color: var(--fg);
  border: 1px solid var(--border-strong);
}
button.secondary:hover, .btn.secondary:hover { border-color: var(--muted); background: rgba(255,255,255,0.02); }
.card {
  background: linear-gradient(180deg, var(--card) 0%, var(--card-2) 100%);
  border: 1px solid var(--border);
  border-radius: 12px; padding: 22px; margin: 16px 0;
  position: relative;
}
.card.glow { box-shadow: 0 0 0 1px rgba(0,229,160,0.08), 0 12px 40px rgba(0,229,160,0.06); }
code, pre {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;
  font-size: 13px; line-height: 1.6;
}
code {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  padding: 1px 6px; border-radius: 4px; color: var(--fg);
  font-size: 12.5px;
}
pre {
  background: #030305;
  border: 1px solid var(--border);
  padding: 14px 16px; padding-right: 64px;
  border-radius: 8px; overflow-x: auto; user-select: all;
  color: #D4D4D8; margin: 8px 0;
}
pre::before {
  content: '$'; color: var(--accent); margin-right: 10px; user-select: none; font-weight: 500;
}
pre.no-prompt::before { content: ''; margin: 0; }
.copy { position: relative; }
.copy .copy-btn {
  position: absolute; top: 8px; right: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-strong); color: var(--muted);
  padding: 3px 10px; font-size: 11px; border-radius: 5px; cursor: pointer;
  font-family: 'Geist Mono', ui-monospace, monospace;
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: all 120ms;
}
.copy .copy-btn:hover { color: var(--accent); border-color: var(--accent); }
footer {
  padding: 28px; color: var(--dim); font-size: 12.5px;
  border-top: 1px solid var(--border); text-align: center;
  font-family: 'Geist Mono', ui-monospace, monospace;
}
.tag {
  display: inline-block; background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-strong);
  color: var(--muted); padding: 2px 10px; border-radius: 999px;
  font-size: 11px; font-family: 'Geist Mono', ui-monospace, monospace;
  text-transform: uppercase; letter-spacing: 0.5px; margin-right: 6px;
}
.tag.accent { color: var(--accent); border-color: rgba(0,229,160,0.3); background: var(--accent-soft); }
.danger { color: var(--danger); }
.hero { text-align: center; padding: 24px 0 8px; }
.hero .eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 12px; color: var(--muted);
  padding: 6px 14px; border: 1px solid var(--border-strong);
  border-radius: 999px; margin-bottom: 28px;
  background: rgba(255,255,255,0.02);
}
.hero .eyebrow .pulse {
  width: 6px; height: 6px; background: var(--accent); border-radius: 50%;
  box-shadow: 0 0 8px var(--accent); animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 50% { opacity: 0.4; } }
.hero h1 {
  font-size: 56px; letter-spacing: -2px; line-height: 1.05;
  background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero p.lead { font-size: 18px; max-width: 540px; margin: 16px auto 28px; color: #A1A1AA; }
.center { text-align: center; }
.brand-big {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 22px; font-weight: 600; color: var(--fg); letter-spacing: -0.5px;
  text-align: center; margin-bottom: 4px;
}
.brand-big .dot { color: var(--accent); }
ul.steps { list-style: none; padding: 0; margin: 8px 0; }
ul.steps li {
  padding: 18px 0; border-bottom: 1px solid var(--border);
  display: flex; gap: 16px; align-items: flex-start;
}
ul.steps li:last-child { border-bottom: 0; }
ul.steps .num {
  flex: 0 0 28px; height: 28px; border-radius: 6px;
  background: var(--card); border: 1px solid var(--border-strong);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--accent);
  font-family: 'Geist Mono', ui-monospace, monospace; font-weight: 500;
}
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.row.center { justify-content: center; }
.divider {
  height: 1px; background: linear-gradient(90deg, transparent, var(--border-strong), transparent);
  margin: 48px 0;
}
.kbd {
  display: inline-block; font-family: 'Geist Mono', monospace; font-size: 11px;
  padding: 2px 6px; background: var(--card); border: 1px solid var(--border-strong);
  border-bottom-width: 2px; border-radius: 4px; color: var(--muted);
}
@media (max-width: 600px) {
  main { padding: 40px 18px 32px; }
  h1, .hero h1 { font-size: 34px; letter-spacing: -1px; }
  header { padding: 14px 18px; }
  header nav { gap: 14px; }
}
`;

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const inline = (s: string): string => {
    let t = escape(s);
    t = t.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, txt, href) => `<a href="${txt && href ? href : "#"}" rel="noopener">${txt}</a>`);
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, pre, url) => `${pre}<a href="${url}" rel="noopener">${url}</a>`);
    return t;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      const langAttr = lang ? ` data-lang="${escape(lang)}"` : "";
      out.push(`<div class="copy"><pre class="no-prompt"${langAttr}>${escape(buf.join("\n"))}</pre></div>`);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const m = line.match(/^(#{1,6})\s+(.*)$/)!;
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      i++; continue;
    }
    if (/^\s*---+\s*$/.test(line)) { out.push("<hr/>"); i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`); continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
      out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      out.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ol>`); continue;
    }
    if (line.trim() === "") { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#|```|>|\s*[-*+]\s|\s*\d+\.\s|---)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

function shell(title: string, body: string, opts: { authed?: boolean; wide?: boolean } = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(title)} · npad</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>${CSS}</style>
</head>
<body>
  <header>
    <a href="/" class="brand" style="text-decoration:none;">npad<span class="dot">.</span>ai<span class="caret"></span></a>
    <nav>
      <a href="/">home</a>
      <a href="/install">install</a>
      ${opts.authed ? `<a href="/dashboard">dashboard</a><a href="#" id="logout">logout</a>` : `<a href="/login">sign in</a>`}
      <a href="https://github.com/ibedevesh/npad-ai" target="_blank" rel="noopener">github</a>
    </nav>
  </header>
  <main${opts.wide ? ' class="wide"' : ""}>${body}</main>
  <footer>npad · notepad for agents · MIT · <a href="https://github.com/ibedevesh/npad-ai" style="color:var(--muted);">github</a></footer>
  <script>
    document.querySelectorAll('.copy').forEach(el => {
      const btn = document.createElement('button');
      btn.className = 'copy-btn'; btn.textContent = 'copy';
      btn.onclick = async () => {
        const code = el.querySelector('pre, code');
        await navigator.clipboard.writeText((code?.textContent || '').trim());
        btn.textContent = 'copied!'; setTimeout(() => btn.textContent = 'copy', 1200);
      };
      el.appendChild(btn);
    });
    const logout = document.getElementById('logout');
    if (logout) logout.onclick = (e) => {
      e.preventDefault(); localStorage.removeItem('npad_apiKey'); location.href = '/';
    };
  </script>
</body>
</html>`;
}

export function landing(): string {
  const body = `
    <div class="hero">
      <div class="eyebrow">v0.2 · open source · MIT</div>
      <h1>notepad<br/>for agents.</h1>
      <p class="lead">A single scratchpad your agents read and write to — across terminals, sessions, and tools. Save once, recall forever.</p>
      <div class="row center" style="margin-top: 28px;">
        <a class="btn primary" href="/login">→ Get started</a>
        <a class="btn secondary" href="https://github.com/ibedevesh/npad-ai" target="_blank">View on GitHub</a>
      </div>
    </div>

    <div class="divider"></div>

    <h2>How it works</h2>
    <ul class="steps">
      <li><span class="num">01</span><div><b>Save.</b> In any agent (Claude, Codex, Cursor), say <i>"save this to npad"</i>. The agent calls <code>note_write</code> and gets back a short id.</div></li>
      <li><span class="num">02</span><div><b>Recall.</b> In a fresh terminal, ask <i>"did we figure out X?"</i>. The agent calls <code>note_search</code> and finds it.</div></li>
      <li><span class="num">03</span><div><b>Share.</b> Mark a note <code>unlisted</code> and you get a URL like <code>npad.run/n/abc</code>. Paste it to a teammate — their agent reads it. Knowledge compounds.</div></li>
    </ul>

    <h2 id="install">Install · 3 commands</h2>
    <div class="copy"><pre>npm i -g @npad/cli</pre></div>
    <div class="copy"><pre>npad login</pre></div>
    <div class="copy"><pre>claude mcp add --scope user npad -- npx -y @npad/mcp</pre></div>
    <p class="muted">Restart your agent. Done — your Claude Code / Codex / Cursor now has 6 npad tools.</p>

    <h2>Local-first</h2>
    <p>npad works offline against a local SQLite DB by default. Sign in only when you want to sync across machines or share notes with others.</p>
  `;
  return shell("npad — notepad for agents", body);
}

export function installPage(): string {
  const body = `
    <h1>Install npad</h1>
    <p>A notepad your AI agents (Claude Code, Codex, Cursor — anything MCP-compatible) read and write to. Knowledge persists across terminals, sessions, and tools.</p>

    <h2>01 · Install the CLI</h2>
    <div class="copy"><pre>npm i -g @npad/cli</pre></div>

    <h2>02 · Sign in</h2>
    <div class="copy"><pre>npad login</pre></div>
    <p class="muted">Opens a browser. Sign in with Google. Your CLI captures the API key into <code>~/.npad/config.json</code> automatically.</p>

    <h2>03 · Wire up your agent</h2>
    <p><b>Claude Code</b></p>
    <div class="copy"><pre>claude mcp add --scope user npad -- npx -y @npad/mcp</pre></div>
    <p>Restart Claude Code. Type <span class="kbd">/mcp</span> to confirm npad is connected.</p>

    <p style="margin-top:18px;"><b>Codex · Cursor · others</b> — add the MCP server <code>npx -y @npad/mcp</code> to your agent's MCP config. Set <code>NPAD_API_KEY</code> from <code>~/.npad/config.json</code>.</p>

    <h2>What you get</h2>
    <div class="card">
      <ul style="margin:0; padding-left:18px; color:#A1A1AA;">
        <li><code>note_write</code> — save notes from inside any agent</li>
        <li><code>note_read</code> — fetch a note by id or URL</li>
        <li><code>note_search</code> — keyword search across your vault</li>
        <li><code>note_append</code> · <code>note_fork</code> · <code>note_delete</code></li>
      </ul>
    </div>

    <h2>Verify</h2>
    <div class="copy"><pre>npad doctor</pre></div>
    <p>Should show <code>mode: hosted</code> and your signed-in email. Then ask any agent: <i>"save this to npad"</i>.</p>
  `;
  return shell("Install npad", body);
}

export function login(): string {
  const body = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-mark">
          <span class="login-mark-text">npad<span class="dot">.</span>ai</span>
          <span class="caret"></span>
        </div>
        <div class="login-eyebrow">notepad for agents</div>

        <h1 class="login-title">Sign in</h1>
        <p class="login-sub">One click with Google. No password, no setup. Your CLI picks up the key automatically.</p>

        <button id="signin" class="login-btn">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 36.5 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
          <span>Continue with Google</span>
        </button>

        <p class="muted" id="status" style="margin: 16px 0 0; min-height: 18px; font-size: 13px; text-align: center;"></p>

        <div class="login-divider"><span>or</span></div>

        <div class="login-cli">
          <div class="login-cli-label">already have the CLI?</div>
          <div class="copy"><pre>npad login</pre></div>
        </div>

        <div class="login-foot">
          <span>● secure</span><span class="dot-sep">·</span>
          <span>google oauth</span><span class="dot-sep">·</span>
          <span>open source</span>
        </div>
      </div>
      <p class="muted login-terms">By signing in you agree to our <a href="https://github.com/ibedevesh/npad-ai">terms</a>.</p>
    </div>
    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
      import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

      const cfg = ${JSON.stringify(FIREBASE_CONFIG)};
      const app = initializeApp(cfg);
      const auth = getAuth(app);
      const status = document.getElementById('status');
      const btn = document.getElementById('signin');

      // Persist cli_port across the redirect, so the post-redirect page can still POST to it.
      const params = new URLSearchParams(location.search);
      const cliPort = params.get('cli_port');
      if (cliPort) sessionStorage.setItem('npad_cli_port', cliPort);

      async function postKeyToCli(apiKey, dbUser) {
        const port = sessionStorage.getItem('npad_cli_port');
        if (!port) return false;
        try {
          await fetch('http://127.0.0.1:' + port + '/callback', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ apiKey, user: dbUser })
          });
          sessionStorage.removeItem('npad_cli_port');
          status.textContent = 'Signed in! You can close this tab.';
          status.className = '';
          return true;
        } catch (e) {
          status.textContent = 'Could not reach the CLI. Re-run npad login in your terminal — your key is safe.';
          status.className = 'danger';
          return false;
        }
      }

      // Fast path: if a key is already in localStorage and a cli_port is in the URL,
      // POST the existing key to the CLI without re-doing OAuth. This handles the case
      // where the user already signed in earlier and is just rerunning npad login.
      if (cliPort) {
        const existingKey = localStorage.getItem('npad_apiKey');
        const existingUser = localStorage.getItem('npad_user');
        if (existingKey) {
          status.textContent = 'using your existing session…';
          await postKeyToCli(existingKey, existingUser ? JSON.parse(existingUser) : null);
        }
      }

      async function exchangeAndFinish(user) {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          status.textContent = 'failed: ' + (err.error || res.status);
          status.className = 'danger';
          return;
        }
        const { apiKey, user: dbUser } = await res.json();
        localStorage.setItem('npad_apiKey', apiKey);
        localStorage.setItem('npad_user', JSON.stringify(dbUser));

        const port = sessionStorage.getItem('npad_cli_port');
        if (port) {
          await postKeyToCli(apiKey, dbUser);
          return;
        }
        location.href = '/dashboard';
      }

      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          status.textContent = 'finishing sign-in…';
          await exchangeAndFinish(result.user);
        }
      } catch (e) {
        status.textContent = 'sign-in failed: ' + e.message;
      }

      btn.onclick = async () => {
        status.textContent = 'redirecting to Google…';
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
        } catch (e) {
          status.textContent = 'sign-in failed: ' + e.message;
        }
      };
    </script>
  `;
  return shell("Sign in", body);
}

export function deviceLinkPage(code: string): string {
  const safeCode = escape(code);
  const body = `
    <div class="center" style="padding-top: 32px;">
      <div class="brand-big">npad<span class="dot">.</span>ai</div>
      <p class="muted" style="margin-bottom: 36px; font-family: 'Geist Mono', monospace; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">authorize device</p>
      <div class="card glow" style="max-width: 460px; margin: 0 auto; padding: 32px 28px;">
        <h1 style="font-size: 22px; margin-bottom: 8px; letter-spacing: -0.5px;">Confirm device code</h1>
        <p style="margin-bottom: 20px;">Make sure this matches what your terminal showed.</p>
        <div style="background: #030305; border: 1px solid var(--border-strong); border-radius: 10px; padding: 18px; margin-bottom: 24px;">
          <div style="font-family: 'Geist Mono', monospace; font-size: 28px; letter-spacing: 8px; text-align: center; color: var(--accent); user-select: all; text-shadow: 0 0 12px rgba(0,229,160,0.4);">${safeCode}</div>
        </div>
        <button id="signin" class="primary" style="width:100%;">
          <svg width="16" height="16" viewBox="0 0 48 48" style="display:inline-block; vertical-align:middle;"><path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 36.5 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
          Authorize with Google
        </button>
        <p class="muted" id="status" style="margin: 20px 0 0; min-height: 18px; font-size: 13px;"></p>
      </div>
    </div>
    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
      import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

      const cfg = ${JSON.stringify(FIREBASE_CONFIG)};
      const app = initializeApp(cfg);
      const auth = getAuth(app);
      const status = document.getElementById('status');
      const btn = document.getElementById('signin');
      const code = ${JSON.stringify(code)};

      async function linkDevice(idToken) {
        status.textContent = 'authorizing…';
        const res = await fetch('/api/auth/device/link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code, idToken })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          status.textContent = 'failed: ' + (err.error || res.status);
          status.className = 'danger';
          return;
        }
        const { email } = await res.json();
        status.textContent = '✓ Authorized as ' + email + '. You can close this tab — your terminal is taking over from here.';
        status.className = '';
        btn.style.display = 'none';
      }

      // If we already have a valid Firebase session, sign-in is one click and reuses it.
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          await linkDevice(await result.user.getIdToken());
        } else if (auth.currentUser) {
          await linkDevice(await auth.currentUser.getIdToken());
        }
      } catch (e) {
        status.textContent = 'sign-in failed: ' + e.message;
      }

      btn.onclick = async () => {
        if (auth.currentUser) {
          await linkDevice(await auth.currentUser.getIdToken());
          return;
        }
        status.textContent = 'redirecting to Google…';
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
        } catch (e) {
          status.textContent = 'sign-in failed: ' + e.message;
        }
      };
    </script>
  `;
  return shell("Authorize CLI", body);
}

export function dashboard(): string {
  const body = `
    <div class="row" style="justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
      <div>
        <p class="muted" style="margin: 0; font-family: 'Geist Mono', monospace; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">dashboard</p>
        <h1 style="margin-top: 4px;">Welcome back.</h1>
      </div>
      <span class="tag accent">● connected</span>
    </div>
    <p>Your account is live. Wire up your AI agents with the snippets below.</p>

    <h2>API key</h2>
    <div class="card glow">
      <p class="muted" style="margin-bottom: 12px; font-size: 13px;">⚠ Treat this like a password — anyone with this key can read and write your notes.</p>
      <div class="copy"><pre id="apikey" class="no-prompt">loading…</pre></div>
    </div>

    <h2>Set up Claude Code</h2>
    <ul class="steps">
      <li><span class="num">01</span><div>Install the CLI<div class="copy" style="margin-top:6px;"><pre>npm i -g @npad/cli</pre></div></div></li>
      <li><span class="num">02</span><div>Log in — writes <code>~/.npad/config.json</code><div class="copy" style="margin-top:6px;"><pre>npad login</pre></div></div></li>
      <li><span class="num">03</span><div>Register the MCP server<div class="copy" style="margin-top:6px;"><pre id="mcp-snippet">claude mcp add --scope user npad -- npx -y @npad/mcp</pre></div></div></li>
      <li><span class="num">04</span><div>Restart Claude Code. Your agent now has 6 npad tools.</div></li>
    </ul>

    <h2>Try it</h2>
    <div class="card">
      <p style="margin: 0;">In Claude Code, say: <i>"save how we fixed X to npad"</i>. The agent calls <code>note_write</code> and returns a short id. From any terminal: <i>"how did we fix X?"</i> — the agent calls <code>note_search</code> and reads the note back.</p>
    </div>

    <script>
      const key = localStorage.getItem('npad_apiKey');
      if (!key) location.href = '/login';
      else document.getElementById('apikey').textContent = key;
    </script>
  `;
  return shell("Dashboard", body, { authed: true });
}

export function notePreview(note: { id: string; title: string; visibility: string; updatedAt: number; body?: string | null }): string {
  const visBadge = note.visibility === "domain" ? "company" : "unlisted";
  const ageDays = Math.floor((Date.now() - note.updatedAt) / (1000 * 60 * 60 * 24));
  const ageStr = ageDays === 0 ? "today" : ageDays === 1 ? "1 day ago" : `${ageDays} days ago`;
  const hasBody = note.visibility !== "private" && typeof note.body === "string" && note.body.length > 0;
  const shareUrl = `https://npad.run/n/${note.id}`;
  const charCount = hasBody ? note.body!.length : 0;

  const bodyBlock = hasBody
    ? `
      <div class="raw-note">
        <div class="raw-note-head">
          <span>● ${escape(note.title)}.md</span>
          <span class="raw-note-meta">${charCount.toLocaleString()} chars · read-only</span>
        </div>
        <pre class="no-prompt raw-note-body">${escape(note.body!)}</pre>
      </div>
    `
    : `
      <div class="card">
        <p style="margin: 0;">🔒  This note is private. Only the owner can read its contents.</p>
      </div>
    `;

  const body = `
    <div class="note-meta">
      <span style="color: var(--accent);">● ${escape(visBadge)}</span>
      <span class="dot-sep">·</span>
      <span>updated ${escape(ageStr)}</span>
      <span class="dot-sep">·</span>
      <span>id ${escape(note.id)}</span>
      ${hasBody ? `<span class="dot-sep">·</span><span>${charCount.toLocaleString()} chars</span>` : ""}
    </div>
    <h1 class="note-title">${escape(note.title)}</h1>

    ${bodyBlock}

    ${hasBody ? `
    <div class="share-bar">
      <div>
        <div class="label">feed this URL to your agent</div>
        <div class="url" style="margin-top: 6px;">${escape(shareUrl)}</div>
      </div>
      <div class="actions">
        <button class="secondary" id="copy-url">copy url</button>
        <a class="btn primary" href="/install">install npad</a>
      </div>
    </div>
    <p class="muted" style="font-size: 12.5px; margin-top: 14px; text-align: center;">
      paste the URL into Claude Code, Codex or Cursor — the agent fetches the full body via npad's API.
    </p>
    ` : ""}

    <script>
      (function() {
        const cu = document.getElementById('copy-url');
        if (cu) cu.onclick = async () => {
          await navigator.clipboard.writeText(${JSON.stringify(shareUrl)});
          cu.textContent = 'copied!';
          setTimeout(() => cu.textContent = 'copy url', 1200);
        };
        // Discourage copying the body — the goal is to share the URL, not the contents.
        const rb = document.querySelector('.raw-note-body');
        if (rb) rb.addEventListener('copy', (e) => e.preventDefault());
      })();
    </script>
  `;
  return shell(note.title, body, { wide: true });
}

export function notFound(): string {
  const body = `
    <div class="center" style="padding-top: 64px;">
      <div style="font-family: 'Geist Mono', monospace; font-size: 96px; color: var(--accent); line-height: 1; text-shadow: var(--accent-glow); letter-spacing: -4px;">404</div>
      <h1 style="margin-top: 16px;">Note not found</h1>
      <p>This note doesn't exist, or it's private.</p>
      <div class="row center" style="margin-top: 24px;">
        <a class="btn primary" href="/">← Back home</a>
        <a class="btn secondary" href="/install">Install npad</a>
      </div>
    </div>
  `;
  return shell("Not found", body);
}
