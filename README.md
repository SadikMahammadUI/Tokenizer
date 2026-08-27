# Token / Cost Inspector

A small internal tool: paste text or upload a `.txt` / `.pdf` / `.docx` / image
file, run it through **your own** OpenAI or Gemini API key, and see exactly
how many input/output tokens it used and what it cost in USD and INR.

Everything runs **entirely in the browser** — there is no backend, no
database, and your API key is only ever held in that browser tab's memory for
that session. This also means it's free to host: it's just static files.

## How it works

1. Pick a provider (OpenAI or Gemini) and a model.
2. Paste your API key (see "Getting an API key" below).
3. Upload a file or paste text.
4. Click **Run & measure cost** — the app extracts the text (or, for images,
   sends the image directly), asks the model to summarize it, and reads the
   real token usage back from the API's own response.
5. The readout panel shows input tokens, output tokens, total tokens, and
   cost in USD + INR (using an editable exchange rate).

Supported inputs: `.txt`, `.md`, `.csv`, `.pdf` (must have selectable text,
not a scanned image), `.docx`, and images (`.png`/`.jpg`/`.webp`/`.gif`,
which get summarized directly by the model's vision capability). Legacy
`.doc` is not supported — save as `.docx` first.

## Getting an API key

- **Gemini (free tier available):** go to
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey), sign in
  with a Google account, and click "Create API key". Free-tier keys work
  fine with the Flash / Flash-Lite models in this app.
- **OpenAI:** go to
  [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
  OpenAI does not offer an always-free tier for API usage — you'll need a
  small credit balance.

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL.

## Deploy for free so your team can use it

Because this is a static site (no server, no secrets baked in — each person
enters their own key), any static host works. Two easy options:

### Option A — Vercel (recommended, ~2 minutes)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → "Add New Project" → import the
   repo.
3. Framework preset: **Vite**. Leave build command (`npm run build`) and
   output directory (`dist`) as detected.
4. Click **Deploy**. Vercel gives you a shareable `https://your-app.vercel.app`
   URL — send that to your teammates.
5. Every future `git push` auto-redeploys.

### Option B — Netlify

1. Push this folder to a GitHub repo (or drag-and-drop the built `dist/`
   folder at [app.netlify.com/drop](https://app.netlify.com/drop) for a
   one-off deploy with no git needed).
2. If connecting via GitHub: build command `npm run build`, publish
   directory `dist`.
3. Netlify gives you a shareable URL, same idea as Vercel.

Both have generous free tiers that comfortably cover an internal team tool
like this.

## Updating prices

All per-model pricing lives in one place: `src/pricing.js`. Providers change
prices often — before trusting a number for real budgeting, check:

- OpenAI: https://openai.com/api/pricing
- Gemini: https://ai.google.dev/gemini-api/docs/pricing

The USD→INR rate shown in the app is just a starting default — it's an
editable field in the UI so anyone can correct it to the day's rate.

## LangSmith tracing (team visibility)

Every run (model, tokens, cost, latency, and short previews of the prompt
and response) can be logged to a shared [LangSmith](https://smith.langchain.com)
project so your team can see everyone's usage in one dashboard.

**Important:** the LangSmith key is a *shared team credential*, unlike the
OpenAI/Gemini key each person types in (which never leaves their browser).
For that reason, tracing is **not** done directly from the browser — it goes
through a small serverless function (`api/log-run.js`) so the LangSmith key
stays a server-only secret and is never shipped to anyone's browser.

Setup:

1. Get a LangSmith API key from
   [smith.langchain.com](https://smith.langchain.com) → Settings → API Keys.
2. In your Vercel project → **Settings → Environment Variables**, add:
   - `LANGSMITH_API_KEY` = your key
   - `LANGSMITH_PROJECT` = a project name, e.g. `token-cost-inspector` (optional — defaults to that name)
3. Redeploy. The "Log runs to LangSmith" checkbox in the app is on by
   default; if the env var isn't set yet, runs still work fine — the app
   just shows a quiet "tracing skipped" note instead of failing.
4. View traces at `https://smith.langchain.com` under the project name you set.

This only works out of the box on **Vercel** (functions in `/api` are
auto-detected). If you deploy to Netlify instead, move `api/log-run.js` into
`netlify/functions/log-run.js` and adjust the fetch path in
`src/lib/langsmith.js` from `/api/log-run` to `/.netlify/functions/log-run`.

## Notes / limitations

- Scanned PDFs (images of text, no selectable text layer) aren't parsed —
  upload them as an image instead so the model can read them directly.
- Very large files may exceed a model's context window or take a while to
  upload; there's no chunking logic in this first version.
- Token counts and costs come straight from each provider's own API
  response (`usage` for OpenAI, `usageMetadata` for Gemini), so they reflect
  that provider's actual tokenizer — not an estimate.
