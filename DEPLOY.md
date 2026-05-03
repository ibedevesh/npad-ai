# Deploying npad to Vercel

This walks through the one-time deploy of the hosted server. After this, anyone
can sign in via Google and use `npad login` to sync.

## Prerequisites

- Vercel account
- Firebase project (`npad-ffae2` already configured)
- ~10 minutes

## Steps

### 1. Create a Neon Postgres DB

```bash
# from the repo root
vercel link              # link this repo to a Vercel project
```

Then in the Vercel dashboard:

1. Open your `npad-ai` project
2. **Storage** tab → **Create Database** → **Neon Postgres**
3. Pick the free tier, click create
4. Vercel auto-injects `DATABASE_URL` as an env var

### 2. Add Firebase Service Account env var

1. Open `secrets/firebase-admin.json` (gitignored, never committed)
2. Copy the entire JSON contents
3. In Vercel: Project Settings → Environment Variables → Add new
   - **Key**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: paste the full JSON
   - **Environments**: Production, Preview, Development

### 3. Deploy

```bash
vercel deploy --prod
```

Vercel will build using `vercel.json`. The Hono app at `api/index.ts` handles all
routes, runs migrations on cold start, and serves the web pages + API.

### 4. Update Firebase OAuth redirect

In Firebase Console:

1. Authentication → Settings → Authorized domains
2. Add your Vercel domain (e.g. `npad-ai-xyz.vercel.app`)
3. Add `npad.ai` later when you buy the domain

### 5. Smoke test

```bash
# from anywhere
npad login
# browser opens → sign in with Google → CLI captures key
npad doctor
# should show "mode: hosted (https://your-domain.vercel.app)"
```

If it works, you're live. Tell the world.

## Post-deploy checklist

- [ ] `npad login` works end-to-end
- [ ] `npad new` writes to Neon (verify in Vercel → Storage → Neon → Tables)
- [ ] `note_search` works through your Claude Code MCP
- [ ] An `unlisted` note's URL renders the title-only page when opened in a browser
- [ ] A second Google account can `npad login` and create their own notes
- [ ] Domain visibility: two users with the same email domain can read each other's `domain`-scoped notes

## Custom domain (later)

When you buy `npad.ai`:

1. Vercel: Project Settings → Domains → Add `npad.ai`
2. Update DNS at your registrar to point to Vercel
3. Firebase Console → Authentication → Authorized domains → add `npad.ai`
4. (No code changes needed)

## Cost expectations (v2 scale)

- Vercel Hobby: free for ~100k requests/mo
- Neon free tier: 0.5 GB storage, ample for 10k+ notes
- Firebase Auth: free up to 50k MAU

Up to a few hundred users, this whole stack costs $0 (plus the future $70 for the
domain when you buy it).
