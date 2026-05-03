/**
 * Server-rendered HTML pages — no React, no client framework.
 * Just template literals + a tiny embedded Firebase JS SDK for sign-in.
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBYClcrmzDnNlBk2KgHbQwL4bspiCCnbTU",
  authDomain: "npad-ffae2.firebaseapp.com",
  projectId: "npad-ffae2",
  storageBucket: "npad-ffae2.firebasestorage.app",
  messagingSenderId: "250385425072",
  appId: "1:250385425072:web:ee9d57ea769fc76ee49175",
};

const CSS = `
:root {
  --bg: #0a0a0b;
  --fg: #e8e8ea;
  --muted: #8a8a90;
  --accent: #5eead4;
  --accent-hover: #2dd4bf;
  --border: #1f1f24;
  --card: #111114;
  --danger: #f87171;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  min-height: 100vh; display: flex; flex-direction: column;
}
header {
  padding: 18px 28px; border-bottom: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
}
header .brand { font-weight: 700; letter-spacing: 0.5px; color: var(--accent); }
header nav a { color: var(--muted); text-decoration: none; margin-left: 18px; font-size: 14px; }
header nav a:hover { color: var(--fg); }
main { flex: 1; max-width: 720px; margin: 0 auto; padding: 56px 24px; width: 100%; }
h1 { font-size: 36px; line-height: 1.2; margin: 0 0 16px; letter-spacing: -0.5px; }
h2 { font-size: 18px; margin: 32px 0 12px; color: var(--fg); }
p { color: var(--muted); margin: 0 0 16px; }
a { color: var(--accent); }
button, .btn {
  background: var(--accent); color: #0a0a0b; border: 0; padding: 12px 22px;
  font-weight: 600; font-size: 15px; border-radius: 8px; cursor: pointer;
  font-family: inherit;
}
button:hover, .btn:hover { background: var(--accent-hover); }
button.secondary, .btn.secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
button.secondary:hover { border-color: var(--muted); }
.card {
  background: var(--card); border: 1px solid var(--border); border-radius: 12px;
  padding: 24px; margin: 16px 0;
}
code, pre {
  font: 13px/1.5 ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace;
  color: var(--accent);
}
pre {
  background: #050507; border: 1px solid var(--border); padding: 14px 16px;
  border-radius: 8px; overflow-x: auto; user-select: all;
}
.copy { position: relative; }
.copy .copy-btn {
  position: absolute; top: 8px; right: 8px;
  background: var(--card); border: 1px solid var(--border); color: var(--muted);
  padding: 4px 10px; font-size: 12px; border-radius: 6px; cursor: pointer;
}
.copy .copy-btn:hover { color: var(--fg); }
footer { padding: 24px 28px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--border); text-align: center; }
.muted { color: var(--muted); }
.tag { display: inline-block; background: var(--card); color: var(--muted); padding: 2px 10px; border-radius: 999px; font-size: 12px; margin-right: 6px; }
.danger { color: var(--danger); }
.hero { text-align: center; padding-top: 32px; }
.hero p.lead { font-size: 17px; }
.center { text-align: center; }
.brand-big {
  font-size: 28px; font-weight: 700; color: var(--accent); letter-spacing: 1px;
  text-align: center; margin-bottom: 6px;
}
ul.steps { list-style: none; padding: 0; }
ul.steps li {
  padding: 14px 0; border-bottom: 1px solid var(--border);
  display: flex; gap: 14px; align-items: start;
}
ul.steps li:last-child { border-bottom: 0; }
ul.steps .num {
  flex: 0 0 28px; height: 28px; border-radius: 14px;
  background: var(--card); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--muted);
}
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
@media (max-width: 600px) {
  main { padding: 32px 18px; }
  h1 { font-size: 28px; }
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

function shell(title: string, body: string, opts: { authed?: boolean } = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(title)} · npad</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='75' font-size='80'%3E📝%3C/text%3E%3C/svg%3E" />
  <style>${CSS}</style>
</head>
<body>
  <header>
    <div class="brand">npad</div>
    <nav>
      <a href="/">home</a>
      ${opts.authed ? `<a href="/dashboard">dashboard</a> <a href="#" id="logout">logout</a>` : `<a href="/login">sign in</a>`}
      <a href="https://github.com/ibedevesh/npad-ai" target="_blank" rel="noopener">github</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer>npad · notepad for agents · open source · MIT</footer>
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
      <div class="brand-big">npad</div>
      <p class="muted" style="margin-bottom: 32px;">notepad for agents</p>
      <h1>Your AI agents finally have memory.</h1>
      <p class="lead">A single scratchpad your agents read and write to — across terminals, sessions, and tools. Save once, recall forever.</p>
      <div class="row" style="justify-content: center; margin-top: 24px;">
        <a class="btn" href="/login">Sign in with Google</a>
        <a class="btn secondary" href="https://github.com/ibedevesh/npad-ai" target="_blank">View on GitHub</a>
      </div>
    </div>
    <h2>How it works</h2>
    <ul class="steps">
      <li><span class="num">1</span><div><b>Save:</b> in any agent (Claude, Codex, Cursor), say "save this to npad". The agent calls <code>note_write</code> and gets back a short id.</div></li>
      <li><span class="num">2</span><div><b>Recall:</b> in a fresh terminal, ask "did we figure out X?". The agent calls <code>note_search</code> and finds it.</div></li>
      <li><span class="num">3</span><div><b>Share:</b> mark a note <code>unlisted</code> and you get a URL like <code>npad.ai/n/abc</code>. Paste it to a teammate. Their agent reads it. Knowledge compounds.</div></li>
    </ul>
    <h2>Local-first</h2>
    <p>npad works offline against a local SQLite DB by default. Sign in only when you want to sync across machines or share notes with others.</p>
    <p class="muted">Open source, MIT licensed. <a href="https://github.com/ibedevesh/npad-ai">github.com/ibedevesh/npad-ai</a></p>
  `;
  return shell("npad — notepad for agents", body);
}

export function login(): string {
  const body = `
    <div class="center" style="padding-top: 48px;">
      <div class="brand-big">npad</div>
      <p class="muted" style="margin-bottom: 32px;">notepad for agents</p>
      <h1 style="font-size: 24px;">Sign in to continue</h1>
      <p>One-click sign-in with Google. No password, no setup.</p>
      <div style="margin: 32px 0;">
        <button id="signin">Sign in with Google</button>
      </div>
      <p class="muted" id="status"></p>
    </div>
    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
      import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

      const cfg = ${JSON.stringify(FIREBASE_CONFIG)};
      const app = initializeApp(cfg);
      const auth = getAuth(app);
      const status = document.getElementById('status');
      const btn = document.getElementById('signin');

      // Pass-through for CLI login: if ?cli_port=NNNN is present, after auth
      // we'll POST the API key to http://127.0.0.1:NNNN/callback so the CLI captures it.
      const params = new URLSearchParams(location.search);
      const cliPort = params.get('cli_port');

      btn.onclick = async () => {
        status.textContent = '';
        try {
          const result = await signInWithPopup(auth, new GoogleAuthProvider());
          const idToken = await result.user.getIdToken();
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
          const { apiKey, user } = await res.json();
          localStorage.setItem('npad_apiKey', apiKey);
          localStorage.setItem('npad_user', JSON.stringify(user));

          if (cliPort) {
            try {
              await fetch('http://127.0.0.1:' + cliPort + '/callback', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ apiKey, user })
              });
              status.textContent = 'Signed in! You can close this tab.';
              return;
            } catch (e) {
              status.textContent = 'Signed in, but failed to notify CLI: ' + e.message;
              return;
            }
          }
          location.href = '/dashboard';
        } catch (e) {
          status.textContent = 'sign-in failed: ' + e.message;
        }
      };
    </script>
  `;
  return shell("Sign in", body);
}

export function dashboard(): string {
  const body = `
    <h1>Welcome to npad</h1>
    <p>Your account is ready. Wire up your AI agents with the snippet below.</p>

    <h2>Your API key</h2>
    <div class="card">
      <p class="muted" style="margin-bottom: 8px;">Treat this like a password — anyone with this key can read and write your notes.</p>
      <div class="copy"><pre id="apikey">loading…</pre></div>
    </div>

    <h2>Set up Claude Code</h2>
    <ol>
      <li>Install the CLI:<div class="copy"><pre>npm i -g @npad/cli</pre></div></li>
      <li>Log in (creates <code>~/.npad/config.json</code>):<div class="copy"><pre>npad login</pre></div></li>
      <li>Wire up the MCP server:<div class="copy"><pre id="mcp-snippet">claude mcp add --scope user npad -- npx -y @npad/mcp</pre></div></li>
      <li>Restart Claude Code. Your agent now has 6 npad tools.</li>
    </ol>

    <h2>Try it</h2>
    <p>In Claude Code, say: <i>"save how we fixed X to npad"</i>. The agent calls <code>note_write</code> and returns a short id. From any terminal: <i>"how did we fix X?"</i> — the agent calls <code>note_search</code> and reads the note back.</p>

    <p class="muted" style="margin-top: 32px;"><a href="/">home</a></p>

    <script>
      const key = localStorage.getItem('npad_apiKey');
      if (!key) location.href = '/login';
      else document.getElementById('apikey').textContent = key;
    </script>
  `;
  return shell("Dashboard", body, { authed: true });
}

export function notePreview(note: { id: string; title: string; visibility: string; updatedAt: number }): string {
  const visBadge = note.visibility === "domain" ? "company" : "unlisted";
  const ageDays = Math.floor((Date.now() - note.updatedAt) / (1000 * 60 * 60 * 24));
  const ageStr = ageDays === 0 ? "today" : ageDays === 1 ? "1 day ago" : `${ageDays} days ago`;
  const body = `
    <p class="muted"><span class="tag">${escape(visBadge)}</span><span class="tag">updated ${escape(ageStr)}</span></p>
    <h1>${escape(note.title)}</h1>
    <div class="card">
      <p style="margin: 0;">📝  This note is meant to be read by an AI agent, not a browser. Hand the URL to your agent and it'll fetch the body via npad.</p>
    </div>

    <h2>Read this note in your agent</h2>
    <ol>
      <li>Make sure npad is set up (<a href="/login">sign in</a> if you haven't).</li>
      <li>Paste this URL into your agent (Claude Code, Codex, Cursor):
        <div class="copy"><pre>${escape(`https://npad.ai/n/${note.id}`)}</pre></div>
      </li>
      <li>Tell your agent something like: <i>"read this npad note and continue"</i>.</li>
    </ol>

    <h2>New here?</h2>
    <p>npad is a notepad your AI agents read and write to — knowledge that survives across terminals, projects, and tools.</p>
    <a class="btn" href="/login">Sign in with Google</a>
    <a class="btn secondary" href="/" style="margin-left: 8px;">Learn more</a>
  `;
  return shell(note.title, body);
}

export function notFound(): string {
  const body = `
    <div class="center" style="padding-top: 64px;">
      <h1>not found</h1>
      <p>This note doesn't exist or is private.</p>
      <a class="btn" href="/">Back home</a>
    </div>
  `;
  return shell("Not found", body);
}
