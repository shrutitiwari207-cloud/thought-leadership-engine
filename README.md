# The Thought Leadership Engine

A LinkedIn content + creative generator. A rough thought goes in; a publish-ready post (with optional live market stats) and on-brand carousel/static creative come out — built to 2026 LinkedIn standards.

Built with React + Vite. **Runs on Google Gemini's free API tier**, so it costs nothing to operate. The API key lives in a serverless function and is never exposed in the browser.

---

## Step 1 — Get a FREE Gemini API key

1. Go to **https://aistudio.google.com** and sign in with a Google account.
2. Click **Get API key → Create API key**.
3. Copy it. No credit card required.

> Free tier = ~1,500 requests/day on Gemini Flash, no expiration. Plenty for a launch and a live event. Note: on the free tier, Google may use prompts to improve its models — fine for public content generation, but don't put anything confidential through it.

---

## Step 2 — Put this project on GitHub

```bash
git init
git add .
git commit -m "Thought Leadership Engine"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## Step 3 — Connect the repo to Netlify

- Log in at **netlify.com → Add new site → Import an existing project**.
- Pick GitHub and select your repo.
- Netlify reads `netlify.toml` automatically (build command `npm run build`, publish folder `dist`). Click **Deploy**.

## Step 4 — Add your key

- In Netlify: **Site configuration → Environment variables → Add a variable**.
- Key: `GEMINI_API_KEY`  ·  Value: the key from Step 1.
- Then **Deploys → Trigger deploy → Deploy site** so it's picked up.

## Step 5 — Done

Live at `your-site-name.netlify.app`. Open it and generate a post.

---

## Free vs Pro (already wired in)

- **Free:** single-post generation, up to `25` times per browser, then an upgrade modal appears.
- **Pro:** the "week of content" batch mode.

Both live at the top of `src/App.jsx`:
```js
const FREE_LIMIT = 25;     // free single-post generations per browser
const PRO_CODE = "BREWED"; // unlock code typed into the upgrade box
```

**Unlock Pro:** type `BREWED` into the upgrade modal, or add `?pro=1` to the URL (handy for your live demo). **Waitlist emails** land in **Netlify → Forms → pro-waitlist**.

> The free limit is per-browser (localStorage) — fine for launch, but bypassable. To truly charge later, add real accounts + a payment provider (Stripe/LemonSqueezy) and track usage server-side.

---

## Honest notes

- **Engine:** Gemini 2.5 Flash. Great for content; if you ever want Anthropic-grade output, you can swap the model in `netlify/functions/generate.js` and the request shape in `src/App.jsx` (and switch to a paid key).
- **Rate limit:** the free tier is ~15 requests/minute. If a whole room hits it at once during your event, some may see a brief "try again" — the app auto-retries. For a big crowd, consider enabling Gemini billing (still very cheap) for higher limits.
- **Live stats** uses Gemini's built-in Google Search grounding, which is free — but slower (it searches the web). The app streams so it stays alive.
- **Tailwind** is loaded via CDN for zero config. Fine to launch; install it properly later if you want.

---

## Run it locally (optional)

Plain `npm run dev` runs the UI but not the function. Use the Netlify CLI, which runs both:

```bash
npm install
npm i -g netlify-cli
cp .env.example .env   # paste your real Gemini key into .env
netlify dev
```
