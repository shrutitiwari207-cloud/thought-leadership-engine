// Netlify Function (v2) — keeps your Google Gemini API key on the server and streams
// the response straight back to the browser. The browser never sees your key.
//
// Free tier: get a key at https://aistudio.google.com (no credit card).
// Model: gemini-2.5-flash (free tier, ~1,500 requests/day).

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY is not set. Add it in Netlify → Site settings → Environment variables." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const body = await req.text();

  let upstream;
  try {
    upstream = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body, // forward the request the app built (contents, systemInstruction, tools, generationConfig)
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Upstream request failed: " + e.message }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }

  // Stream Gemini's SSE response straight through to the browser.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "text/event-stream",
      "cache-control": "no-store",
    },
  });
};
