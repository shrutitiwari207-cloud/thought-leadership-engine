import React, { useState } from "react";
import { Sparkles, Copy, Check, RotateCw, Loader2, Coffee, ArrowRight, Lock, Info, Download, ChevronLeft, ChevronRight, Palette, Search, FileText, Image as ImageIcon } from "lucide-react";

// ---- monetization config (change these freely) ----
const FREE_LIMIT = 25;   // free single-post generations per browser before the upgrade wall
const PRO_CODE = "BREWED"; // type this in the upgrade box (or add ?pro=1 to the URL) to unlock Pro

// ---------- modern palette ----------
const C = {
  bg: "#F3F2FE",        // soft lavender canvas
  surface: "#FFFFFF",
  ink: "#171530",       // deep indigo-ink
  muted: "#6C6889",
  hair: "#E7E3F7",
  violet: "#5B3DF5",
  violetDk: "#3E27C9",
  fuchsia: "#A33BF0",
  coral: "#FF6A4D",
  coralSoft: "rgba(255,106,77,0.22)",
  violetSoft: "rgba(91,61,245,0.10)",
};
const GRAD = "linear-gradient(135deg, #5B3DF5 0%, #A33BF0 100%)";
const SHADOW = "0 6px 26px rgba(91,61,245,0.09)";
const serif = 'Georgia, "Times New Roman", serif';
const sans = 'Inter, system-ui, -apple-system, sans-serif';
const mono = '"SF Mono", ui-monospace, "Cascadia Code", monospace';

const ANGLES = [
  { id: "bold", label: "Bold take", hint: "A sharp opinion that picks a side. Contrarian beats safe." },
  { id: "story", label: "Story", hint: "A real moment with a lesson. Builds trust fast." },
  { id: "howto", label: "How-to", hint: "A practical breakdown people save and reuse." },
  { id: "reflective", label: "Reflective", hint: "Honest, thinking-out-loud. Feels human." },
  { id: "news", label: "News reaction", hint: "Your take on something happening in your space right now." },
  { id: "myth", label: "Myth-bust", hint: "Call out a thing everyone believes that's wrong." },
];
const FORMATS = [
  { id: "prose", label: "Paragraphs only", hint: "Flowing short paragraphs. Best for stories and opinions." },
  { id: "mixed", label: "Paragraphs + bullets", hint: "Short paras with a few punchy bullet lines. Best for frameworks — and the most saved format." },
];
const LENGTHS = [
  { id: "quick", label: "Quick take", hint: "~400–600 characters. One sharp idea." },
  { id: "standard", label: "Standard", hint: "1,300–1,900 characters. The 2026 engagement sweet spot." },
  { id: "deep", label: "Deep dive", hint: "~2,000–2,300 characters. Use only when the idea earns it." },
];
const EXAMPLE = {
  role: "Founder of a sustainable apparel startup",
  topic: "Everyone in fashion talks about 'sustainability' but most of it is marketing. The real problem is overproduction — brands make too much and burn the rest.",
  angle: "bold", format: "mixed", length: "standard", audience: "Founders and retail leaders", useStats: true,
};

// ---------- helpers ----------
function readable(hex) {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#171530" : "#FFFFFF";
  } catch { return "#FFFFFF"; }
}
function wrap(text, max) {
  const words = String(text || "").split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
// Calls our serverless function, which forwards to Google's Gemini API (free tier)
// and streams the response back. Streaming keeps long generations alive and feels responsive.
async function _callOnce({ system, user, web, maxTokens = 2000, timeoutMs = 120000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.85, thinkingConfig: { thinkingBudget: 0 } },
  };
  if (web) body.tools = [{ google_search: {} }];                       // free live web grounding
  else body.generationConfig.responseMimeType = "application/json";    // clean JSON when not grounding
  let res;
  try {
    res = await fetch("/.netlify/functions/generate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("That took too long. If live stats are on, try again — searching adds time — or switch stats off for a faster run.");
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok || !res.body) { clearTimeout(timer); throw new Error("The server returned an error. Give it another go in a moment."); }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const d = t.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          const parts = ev && ev.candidates && ev.candidates[0] && ev.candidates[0].content && ev.candidates[0].content.parts;
          if (Array.isArray(parts)) for (const p of parts) if (typeof p.text === "string") text += p.text;
        } catch { /* ignore keep-alives / non-JSON lines */ }
      }
    }
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("That took too long. Try again, or switch live stats off for a faster run.");
    throw new Error("The connection dropped mid-generation. Hit regenerate.");
  }
  clearTimeout(timer);

  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Got a reply but couldn't read it cleanly. Hit regenerate.");
  let slice = text.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1"); // tolerate trailing commas
  try { return JSON.parse(slice); }
  catch { throw new Error("The response came back incomplete. Regenerate — if you're on Deep dive + stats, try Standard."); }
}
// retry wrapper: one bad/slow response self-heals instead of failing the user
async function callClaude(opts) {
  try { return await _callOnce(opts); }
  catch (e1) {
    try { return await _callOnce(opts); }
    catch (e2) { throw e2; }
  }
}

// ---------- UI atoms ----------
function Tip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={() => setOpen((o) => !o)} style={{ color: C.muted, display: "inline-flex", padding: 1 }} aria-label="More info"><Info size={13} /></button>
      {open && (
        <span style={{ position: "absolute", bottom: "140%", left: "50%", transform: "translateX(-50%)", width: 212, background: C.ink, color: "#fff", fontFamily: sans, fontSize: 12, lineHeight: 1.45, padding: "9px 11px", borderRadius: 10, zIndex: 30, boxShadow: "0 10px 30px rgba(23,21,48,0.28)" }}>{text}</span>
      )}
    </span>
  );
}
function Eyebrow({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: C.violet }}>
        <span style={{ width: 16, height: 3, borderRadius: 2, background: GRAD, display: "inline-block" }} />{children}
      </div>{right}
    </div>
  );
}
function Field({ label, tip, children }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", color: C.muted }}>{label}</span>{tip && <Tip text={tip} />}
      </div>{children}
    </div>
  );
}
function Chips({ options, value, onChange, cols = 2 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} className="rounded-xl px-3 py-2 text-left transition-all"
            style={{ border: `1.5px solid ${on ? "transparent" : C.hair}`, background: on ? GRAD : C.surface, color: on ? "#fff" : C.ink, boxShadow: on ? "0 4px 14px rgba(91,61,245,0.25)" : "none" }}>
            <div className="flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600 }}>{o.label}{o.hint && <Tip text={o.hint} />}</div>
          </button>
        );
      })}
    </div>
  );
}
function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch {} }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
      style={{ fontFamily: mono, color: done ? "#fff" : C.violet, border: `1px solid ${done ? "transparent" : C.hair}`, background: done ? C.violet : C.surface }}>
      {done ? <Check size={13} /> : <Copy size={13} />}{done ? "Copied" : label}
    </button>
  );
}
function PrimaryBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 transition-transform"
      style={{ background: GRAD, color: "#fff", fontWeight: 700, fontSize: 15, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer", boxShadow: disabled ? "none" : "0 8px 22px rgba(91,61,245,0.30)" }}>
      {children}
    </button>
  );
}

// ---------- creative slide (pure SVG, exports cleanly) ----------
function Slide({ id, data, brand, kind }) {
  const bg = brand.primary, ac = brand.accent, tx = readable(bg), onAccent = readable(ac);
  const headLines = wrap(data.headline, kind === "cover" || kind === "static" ? 16 : 18);
  return (
    <svg id={id} viewBox="0 0 1080 1080" width="100%" style={{ display: "block", borderRadius: 16, boxShadow: SHADOW }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} /><stop offset="100%" stopColor={ac} stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill={bg} />
      <rect width="1080" height="1080" fill={`url(#g-${id})`} />
      <rect x="0" y="0" width="16" height="1080" fill={ac} />
      {data.kicker ? <text x="80" y="150" fontFamily={mono} fontSize="30" letterSpacing="6" fill={ac}>{String(data.kicker).toUpperCase()}</text>
        : data.n ? <text x="80" y="162" fontFamily={mono} fontSize="44" fill={ac}>{String(data.n).padStart(2, "0")}</text> : null}
      <text x="80" y={kind === "point" ? 360 : 470} fontFamily={serif} fontWeight="700" fontSize={kind === "cover" || kind === "static" ? 86 : 72} fill={tx}>
        {headLines.map((l, i) => <tspan key={i} x="80" dy={i === 0 ? 0 : (kind === "cover" || kind === "static" ? 96 : 82)}>{l}</tspan>)}
      </text>
      {(data.subline || data.line) && (
        <text x="80" y={kind === "point" ? 360 + headLines.length * 82 + 60 : 470 + headLines.length * 96 + 64} fontFamily={sans} fontSize="36" fill={tx} opacity="0.82">
          {wrap(data.subline || data.line, 38).map((l, i) => <tspan key={i} x="80" dy={i === 0 ? 0 : 48}>{l}</tspan>)}
        </text>
      )}
      {data.stat && (<g><rect x="80" y="722" width="920" height="150" rx="18" fill={ac} /><text x="112" y="816" fontFamily={sans} fontWeight="700" fontSize="42" fill={onAccent}>{wrap(data.stat, 40).slice(0, 1)}</text></g>)}
      <text x="80" y="1012" fontFamily={mono} fontSize="28" fill={tx} opacity="0.7">{data.cta || brand.handle || "@yourhandle"}</text>
    </svg>
  );
}
function downloadSlide(id, name) {
  const el = document.getElementById(id); if (!el) return;
  const xml = new XMLSerializer().serializeToString(el);
  const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1080;
    canvas.getContext("2d").drawImage(img, 0, 0, 1080, 1080);
    canvas.toBlob((blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); });
  };
  img.src = src;
}

// ---------- main ----------
export default function App() {
  const [tab, setTab] = useState("content");
  const [brand, setBrand] = useState({ name: "", handle: "", primary: "#5B3DF5", accent: "#FF6A4D" });
  const [showBrand, setShowBrand] = useState(true);

  const [role, setRole] = useState("");
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("bold");
  const [format, setFormat] = useState("mixed");
  const [length, setLength] = useState("standard");
  const [audience, setAudience] = useState("");
  const [useStats, setUseStats] = useState(false);

  const [cLoading, setCLoading] = useState(false);
  const [cErr, setCErr] = useState("");
  const [content, setContent] = useState(null);

  // batch / week-of-content mode
  const [batch, setBatch] = useState(false);
  const [batchResults, setBatchResults] = useState([]);
  const [batchProg, setBatchProg] = useState(null); // {done, total}

  const [creativeType, setCreativeType] = useState("carousel");
  const [crLoading, setCrLoading] = useState(false);
  const [crErr, setCrErr] = useState("");
  const [creative, setCreative] = useState(null);
  const [slideIdx, setSlideIdx] = useState(0);

  // ---- pro / free-limit ----
  const [uses, setUses] = useState(() => { try { return parseInt(localStorage.getItem("tle_uses") || "0", 10) || 0; } catch { return 0; } });
  const [isPro, setIsPro] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("pro");
      if (p === "1") localStorage.setItem("tle_pro", "1");
      return localStorage.getItem("tle_pro") === "1";
    } catch { return false; }
  });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [waitEmail, setWaitEmail] = useState("");
  const [waitDone, setWaitDone] = useState(false);
  const bumpUse = () => setUses((u) => { const n = u + 1; try { localStorage.setItem("tle_uses", String(n)); } catch {} return n; });
  const unlockPro = () => { setIsPro(true); try { localStorage.setItem("tle_pro", "1"); } catch {} setShowUpgrade(false); };
  const tryCode = () => { if (codeInput.trim().toUpperCase() === PRO_CODE) unlockPro(); else setCodeInput(""); };
  const joinWaitlist = async () => {
    try { await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ "form-name": "pro-waitlist", email: waitEmail }).toString() }); } catch {}
    setWaitDone(true);
  };
  const freeLeft = Math.max(0, FREE_LIMIT - uses);

  const loadingLines = useStats
    ? ["Searching the web for stats…", "This part takes 20–40s…", "Checking the sources…", "Writing it like a human…"]
    : ["Reading the room…", "Sharpening the first line…", "Killing the buzzwords…", "Writing it like a human…"];
  const [li, setLi] = useState(0);
  const canGen = role.trim().length > 1 && topic.trim().length > 4 && !cLoading;

  const genContent = async () => {
    if (!isPro && uses >= FREE_LIMIT) { setShowUpgrade(true); return; }
    setCLoading(true); setCErr(""); setContent(null); setLi(0);
    const tick = setInterval(() => setLi((i) => (i + 1) % loadingLines.length), 1500);
    const fmt = FORMATS.find((f) => f.id === format).label;
    const len = LENGTHS.find((l) => l.id === length).label;
    const ang = ANGLES.find((a) => a.id === angle).label;
    const system = `You are an elite LinkedIn ghostwriter for founders and operators. You write posts that sound like a sharp human — never AI — and follow 2026 LinkedIn best practices exactly.

2026 STANDARDS:
- Line one is everything. The first ~200 characters show before "see more"; most readers never click past. Make it stop the scroll. No throat-clearing.
- LENGTH: "Quick take" 400-600 chars. "Standard" 1300-1900 chars (the sweet spot). "Deep dive" 2000-2300 chars. Never pad.
- Break lines aggressively: 1-2 sentences per paragraph, lots of white space.
- Saves are the #1 ranking signal in 2026 — make it worth saving: a framework, a sharp list, a reusable insight.
- Hashtags barely matter: 0-2 specific ones or none.
- No engagement bait, no emoji walls (0-2 max), no links in the body.
- A specific, slightly contrarian POV beats a safe one. Pick a side.
- End with an open question or a "save this" line that earns real replies.

VOICE: Sound like the person, not a brand. Short sentences. Concrete over abstract.
BANNED: leverage, passionate, delve, synergy, unlock, elevate, robust, game-changer, deep dive, paradigm, revolutionary, seamless, supercharge, thought leader, "in today's fast-paced world", "I'm thrilled/excited to announce".
NEVER invent statistics, numbers, company names, or results.

FORMAT: ${fmt}
LENGTH: ${len}
${useStats ? `STATS: ON. Use web_search to find 1-3 genuinely current, specific statistics relevant to this topic and audience. Weave them in and credit the source briefly in-line. List every source. If you cannot verify a stat, leave it out — never approximate.` : `STATS: OFF. Do not invent numbers.`}

Return ONLY a JSON object as your final message (no fences, no commentary):
{"post": string, "charCount": number, "hooks": [string,string,string], "question": string, "sources": [{"title": string, "url": string}]}
sources = [] if none used.`;
    const user = `Who I am: ${role.trim()}
Topic / raw thought: ${topic.trim()}
Angle: ${ang}
Audience: ${audience.trim() || "general LinkedIn professional audience"}`;
    try {
      const r = await callClaude({ system, user, web: useStats, maxTokens: 2200, timeoutMs: useStats ? 100000 : 50000 });
      setContent(r); setCreative(null); bumpUse();
    } catch (e) { setCErr(e.message); } finally { clearInterval(tick); setCLoading(false); }
  };

  // generate a week of content: 1 fast planning call, then short posts one-by-one (robust + shows progress)
  const genWeek = async () => {
    if (!isPro) { setShowUpgrade(true); return; }
    setCLoading(true); setCErr(""); setContent(null); setBatchResults([]); setBatchProg({ done: 0, total: 5 });
    try {
      const planSys = `You plan a week of LinkedIn content for one person. Given their role and theme, return 5 DISTINCT post angles that don't overlap. Mix formats (a bold take, a how-to, a story, a myth-bust, a question/observation).
Return ONLY JSON: {"posts":[{"angle":string,"idea":string}]} with exactly 5 items. "idea" = one specific sentence describing what that post is about.`;
      const planUser = `Role: ${role.trim()}\nTheme: ${topic.trim()}\nAudience: ${audience.trim() || "general professional audience"}`;
      const plan = await callClaude({ system: planSys, user: planUser, web: false, maxTokens: 700, timeoutMs: 45000 });
      const ideas = (plan.posts || []).slice(0, 5);

      const postSys = `You are an elite LinkedIn ghostwriter. Write ONE short, scroll-stopping post (450-750 characters) that sounds like a sharp human, not AI.
Rules: line one must stop the scroll; aggressive line breaks; one idea; end with a question or a save-this line; 0-1 hashtags; never invent stats/numbers.
BANNED: leverage, passionate, delve, unlock, elevate, game-changer, thought leader, "thrilled to announce".
Return ONLY JSON: {"post":string,"hook":string}`;

      for (let i = 0; i < ideas.length; i++) {
        try {
          const one = await callClaude({
            system: postSys,
            user: `Writer: ${role.trim()}\nAngle: ${ideas[i].angle}\nWrite about: ${ideas[i].idea}`,
            web: false, maxTokens: 700, timeoutMs: 40000,
          });
          setBatchResults((prev) => [...prev, { angle: ideas[i].angle, idea: ideas[i].idea, post: one.post, hook: one.hook }]);
        } catch {
          setBatchResults((prev) => [...prev, { angle: ideas[i].angle, idea: ideas[i].idea, post: null, hook: null }]);
        }
        setBatchProg({ done: i + 1, total: ideas.length });
      }
    } catch (e) { setCErr(e.message); }
    finally { setCLoading(false); setBatchProg(null); }
  };

  const genCreative = async () => {
    if (!content) return;
    setCrLoading(true); setCrErr(""); setCreative(null); setSlideIdx(0);
    const system = `You turn a LinkedIn post into ${creativeType === "static" ? "a single static creative" : "a 5-slide carousel"}. Punchy, scannable, built for a phone.

Rules:
- Headlines 3-7 words. No fluff. NEVER invent stats — reuse only a number already in the post. Same banned-words rule.
- ${creativeType === "static"
        ? `Static: one cover. Fields: kicker (1-2 words), headline (4-7 word hook), subline (one line), stat (short stat string ONLY if a real number exists in the post, else null), cta (handle or short follow line).`
        : `Carousel: exactly 5 slides. Slide 1 kind="cover" (big hook + short subline). Slides 2-4 kind="point" (short headline + one line). Slide 5 kind="cta" (takeaway + soft follow CTA line).`}

Return ONLY JSON:
${creativeType === "static"
        ? `{"type":"static","slide":{"kicker":string,"headline":string,"subline":string,"stat":string|null,"cta":string}}`
        : `{"type":"carousel","slides":[{"n":1,"kind":"cover","headline":string,"subline":string},{"n":2,"kind":"point","headline":string,"line":string},{"n":3,"kind":"point","headline":string,"line":string},{"n":4,"kind":"point","headline":string,"line":string},{"n":5,"kind":"cta","headline":string,"line":string}]}`}`;
    const user = `Handle: ${brand.handle || "@yourhandle"}\nPost:\n${content.post}`;
    try {
      const r = await callClaude({ system, user, web: false, maxTokens: 1200, timeoutMs: 45000 });
      setCreative(r);
    } catch (e) { setCrErr(e.message); } finally { setCrLoading(false); }
  };

  const useExample = () => { setRole(EXAMPLE.role); setTopic(EXAMPLE.topic); setAngle(EXAMPLE.angle); setFormat(EXAMPLE.format); setLength(EXAMPLE.length); setAudience(EXAMPLE.audience); setUseStats(EXAMPLE.useStats); };

  const cc = content ? (content.charCount || content.post.length) : 0;
  const firstLine = content ? content.post.split("\n")[0] : "";
  const sweet = cc >= 1300 && cc <= 1900;
  const hookOk = firstLine.length <= 210;
  const inputStyle = { border: `1.5px solid ${C.hair}`, fontSize: 14, color: C.ink, background: C.bg, borderRadius: 12 };
  const cardStyle = { background: C.surface, border: `1px solid ${C.hair}`, boxShadow: SHADOW, borderRadius: 18 };
  const slides = creative ? (creative.type === "static" ? [creative.slide] : creative.slides) : [];

  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: sans, minHeight: "100%", backgroundImage: "radial-gradient(900px 400px at 80% -8%, rgba(163,59,240,0.10), transparent), radial-gradient(700px 360px at -5% 0%, rgba(91,61,245,0.10), transparent)" }}>
      <div className="mx-auto w-full" style={{ maxWidth: 1080, padding: "26px 18px 56px" }}>

        {/* masthead */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4" style={{ borderBottom: `1px solid ${C.hair}`, paddingBottom: 18 }}>
          <div>
            <div className="mb-2 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.16em", color: C.violet }}><Coffee size={13} /> BREWED THOUGHTS · TOOLS</div>
            <h1 style={{ fontFamily: serif, fontSize: 33, lineHeight: 1.05, letterSpacing: "-0.01em", margin: 0, background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>The Thought Leadership Engine</h1>
            <p style={{ color: C.muted, fontSize: 14.5, marginTop: 7, maxWidth: 560 }}>A rough thought in. A publish-ready post, real stats, and on-brand creative out — built to 2026 LinkedIn standards.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ fontFamily: mono, fontSize: 11, background: isPro ? "linear-gradient(135deg,#FF6A4D,#A33BF0)" : C.violetSoft, color: isPro ? "#fff" : C.violet, border: `1px solid ${C.hair}` }}>{isPro ? "PRO" : `FREE · ${freeLeft} left`}</span>
        </header>

        {/* brand bar */}
        <div className="mb-5" style={cardStyle}>
          <button onClick={() => setShowBrand((s) => !s)} className="flex w-full items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.08em", color: C.ink }}><Palette size={14} style={{ color: C.violet }} /> YOUR BRAND <Tip text="Set once. Your handle goes on creatives; your colors theme every card and carousel you generate." /></span>
            <span style={{ fontFamily: mono, fontSize: 11, color: C.violet }}>{showBrand ? "hide" : "edit"}</span>
          </button>
          {showBrand && (
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-4">
              <div><label style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>NAME / BRAND</label><input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} placeholder="Acme Apparel" className="mt-1 w-full px-3 py-2 outline-none" style={inputStyle} /></div>
              <div><label style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>@HANDLE</label><input value={brand.handle} onChange={(e) => setBrand({ ...brand, handle: e.target.value })} placeholder="@acme" className="mt-1 w-full px-3 py-2 outline-none" style={inputStyle} /></div>
              <div><label className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>PRIMARY <Tip text="The background color of your creatives." /></label>
                <div className="mt-1 flex items-center gap-2 px-2 py-1.5" style={{ ...inputStyle, padding: "6px 8px" }}><input type="color" value={brand.primary} onChange={(e) => setBrand({ ...brand, primary: e.target.value })} style={{ width: 30, height: 28, border: "none", background: "none" }} /><span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>{brand.primary}</span></div></div>
              <div><label className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>ACCENT <Tip text="The highlight color — used on numbers, the side bar, and stat callouts." /></label>
                <div className="mt-1 flex items-center gap-2 px-2 py-1.5" style={{ ...inputStyle, padding: "6px 8px" }}><input type="color" value={brand.accent} onChange={(e) => setBrand({ ...brand, accent: e.target.value })} style={{ width: 30, height: 28, border: "none", background: "none" }} /><span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>{brand.accent}</span></div></div>
            </div>
          )}
        </div>

        {/* tabs */}
        <div className="mb-5 flex gap-2">
          {[{ id: "content", n: "1", label: "Content", icon: FileText }, { id: "creative", n: "2", label: "Creative", icon: ImageIcon }].map((t) => {
            const on = tab === t.id; const locked = t.id === "creative" && !content;
            return (
              <button key={t.id} onClick={() => !locked && setTab(t.id)} disabled={locked} className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                style={{ border: `1.5px solid ${on ? "transparent" : C.hair}`, background: on ? GRAD : C.surface, color: on ? "#fff" : (locked ? C.muted : C.ink), opacity: locked ? 0.55 : 1, boxShadow: on ? "0 6px 18px rgba(91,61,245,0.28)" : "none" }}>
                <span style={{ fontFamily: mono, fontSize: 11 }}>{t.n}</span><t.icon size={15} /> <span style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</span>{locked && <Tip text="Generate a post first — the creative is built from it." />}
              </button>
            );
          })}
        </div>

        {/* CONTENT TAB */}
        {tab === "content" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-2">
              <div className="p-5" style={cardStyle}>
                <Eyebrow>WRITE</Eyebrow>
                <Field label="WHO YOU ARE" tip="Your role and angle. The engine writes in your voice and stays in your lane."><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Founder of an AI/ML startup" className="w-full px-3 py-2.5 outline-none" style={inputStyle} /></Field>
                <Field label="TOPIC / RAW THOUGHT" tip="A messy thought is perfect. A hot take, a thing that annoyed you, an idea you keep returning to."><textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} placeholder="What do you want to say? Don't polish it." className="w-full resize-none px-3 py-2.5 outline-none" style={{ ...inputStyle, lineHeight: 1.5 }} /></Field>
                <Field label="AUDIENCE (OPTIONAL)" tip="Who should this land with? Sharpens the language and the examples."><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Early-stage founders, CTOs" className="w-full px-3 py-2.5 outline-none" style={inputStyle} /></Field>
                <Field label="ANGLE"><Chips options={ANGLES} value={angle} onChange={setAngle} cols={2} /></Field>
                <Field label="FORMAT"><Chips options={FORMATS} value={format} onChange={setFormat} cols={1} /></Field>
                <Field label="LENGTH"><Chips options={LENGTHS} value={length} onChange={setLength} cols={3} /></Field>
                <button onClick={() => setUseStats((s) => !s)} className="mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ border: `1.5px solid ${useStats ? "transparent" : C.hair}`, background: useStats ? GRAD : C.surface, color: useStats ? "#fff" : C.ink, boxShadow: useStats ? "0 4px 14px rgba(91,61,245,0.25)" : "none" }}>
                  <span className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600 }}><Search size={15} /> Pull live market stats <Tip text="Searches the web for current, real statistics on your topic and weaves them in with sources. Never invents numbers. Adds ~20–40s." /></span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: useStats ? "#fff" : C.muted }}>{useStats ? "ON" : "OFF"}</span>
                </button>

                {/* week-of-content upsell toggle */}
                <button onClick={() => setBatch((b) => !b)} className="mb-4 flex w-full items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ border: `1.5px solid ${batch ? "transparent" : C.coral}`, background: batch ? "linear-gradient(135deg,#FF6A4D,#A33BF0)" : "rgba(255,106,77,0.08)", color: batch ? "#fff" : C.ink, boxShadow: batch ? "0 4px 14px rgba(255,106,77,0.28)" : "none" }}>
                  <span className="flex flex-col text-left">
                    <span style={{ fontSize: 13, fontWeight: 700 }}>📅 Want a week's content in one go?</span>
                    <span style={{ fontSize: 11, color: batch ? "rgba(255,255,255,0.85)" : C.muted }}>Generate 5 ready-to-post drafts from one theme</span>
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: batch ? "#fff" : C.coral }}>{isPro ? (batch ? "ON" : "OFF") : "PRO 🔒"}</span>
                </button>

                <PrimaryBtn onClick={batch ? genWeek : genContent} disabled={!canGen}>
                  {cLoading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                  {cLoading ? (batch && batchProg ? `Writing ${batchProg.done}/${batchProg.total}…` : "Writing…") : (batch ? "Generate 5 posts" : "Generate post")}
                </PrimaryBtn>
                <div className="mt-3"><button onClick={useExample} style={{ fontFamily: mono, fontSize: 11, color: C.violet, textDecoration: "underline" }}>Try an example</button></div>
              </div>
            </section>

            <section className="lg:col-span-3">
              {!content && batchResults.length === 0 && !cLoading && !cErr && (
                <div className="flex h-full flex-col justify-center p-8" style={{ ...cardStyle, border: `1.5px dashed ${C.hair}`, boxShadow: "none", minHeight: 340 }}>
                  <Eyebrow>YOUR POST</Eyebrow><p style={{ fontFamily: serif, fontSize: 22, lineHeight: 1.3, maxWidth: 400 }}>Publish-ready copy shows up here — sized and formatted to what's working on LinkedIn right now.</p>
                </div>
              )}
              {cLoading && !batch && (<div className="flex h-full flex-col items-center justify-center p-8" style={{ ...cardStyle, minHeight: 340 }}><Loader2 size={26} className="animate-spin" style={{ color: C.violet }} /><p style={{ fontFamily: mono, fontSize: 13, color: C.muted, marginTop: 14 }}>{loadingLines[li]}</p></div>)}
              {cErr && !cLoading && (<div className="p-6" style={cardStyle}><p style={{ fontFamily: mono, fontSize: 12, color: C.coral }}>SOMETHING BROKE</p><p style={{ fontSize: 15, marginTop: 6 }}>{cErr}</p><button onClick={batch ? genWeek : genContent} className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${C.hair}`, fontSize: 13 }}><RotateCw size={14} /> Try again</button></div>)}

              {/* BATCH: week of content */}
              {batch && (batchResults.length > 0 || cLoading) && !cErr && (
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4" style={{ ...cardStyle, border: `1.5px solid ${C.coral}` }}>
                    <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", color: C.coral }}>YOUR WEEK OF CONTENT</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{cLoading ? `writing ${batchProg ? batchProg.done : 0}/${batchProg ? batchProg.total : 5}…` : `${batchResults.filter((b) => b.post).length} posts ready`}</span>
                  </div>
                  {batchResults.map((b, i) => (
                    <div key={i} className="p-5" style={cardStyle}>
                      <div className="mb-2 flex items-center justify-between">
                        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", color: C.violet }}>{String(i + 1).padStart(2, "0")} · {b.angle}</span>
                        {b.post && <CopyButton text={b.post} />}
                      </div>
                      {b.post ? (
                        <>
                          <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{b.post}</div>
                          <button onClick={() => { setContent({ post: b.post, charCount: b.post.length, hooks: [b.hook || b.post.split("\n")[0]], question: "", sources: [] }); setTab("creative"); }}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ border: `1px solid ${C.hair}`, fontSize: 12, background: C.surface, color: C.violet }}>
                            <ImageIcon size={13} /> Send to Creative
                          </button>
                        </>
                      ) : (<div style={{ fontSize: 13, color: C.coral }}>This one didn't generate — <button onClick={genWeek} style={{ textDecoration: "underline" }}>retry the batch</button></div>)}
                    </div>
                  ))}
                  {cLoading && (<div className="flex items-center gap-2 p-4" style={cardStyle}><Loader2 size={16} className="animate-spin" style={{ color: C.violet }} /><span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>writing the next one…</span></div>)}
                </div>
              )}

              {content && !cLoading && !batch && (
                <div className="grid gap-4">
                  <div className="p-5" style={{ ...cardStyle, border: `1.5px solid ${C.violet}` }}>
                    <Eyebrow right={<CopyButton text={content.post} />}>THE POST</Eyebrow>
                    <div style={{ fontSize: 15.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{content.post}</div>
                    <div className="mt-4 flex flex-wrap items-center gap-2" style={{ fontFamily: mono, fontSize: 11 }}>
                      <span className="rounded-full px-2.5 py-1" style={{ background: sweet ? C.violetSoft : C.bg, border: `1px solid ${sweet ? C.violet : C.hair}`, color: sweet ? C.violet : C.muted }}>{cc} chars {sweet ? "· sweet spot" : cc < 1300 ? "· short & punchy" : "· long-form"}</span>
                      <span className="rounded-full px-2.5 py-1" style={{ background: hookOk ? C.violetSoft : "rgba(255,106,77,0.14)", border: `1px solid ${hookOk ? C.violet : C.coral}`, color: hookOk ? C.violet : C.coral }}>{hookOk ? "hook fits before \u201csee more\u201d" : "tighten line 1 — hook may get cut"}</span>
                    </div>
                  </div>
                  {content.sources && content.sources.length > 0 && (
                    <div className="p-5" style={cardStyle}><Eyebrow>STATS PULLED FROM</Eyebrow><div className="grid gap-2">{content.sources.map((s, i) => (<a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2" style={{ fontSize: 13, color: C.violet, textDecoration: "underline" }}><ArrowRight size={13} />{s.title}</a>))}</div></div>
                  )}
                  <div className="p-5" style={cardStyle}>
                    <Eyebrow>ALTERNATE HOOKS</Eyebrow>
                    <div className="grid gap-3">{content.hooks.map((h, i) => (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <p style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.4 }}><span style={{ background: `linear-gradient(104deg, rgba(255,106,77,0) 0.9%, ${C.coralSoft} 2.4%, ${C.coralSoft} 95%, rgba(255,106,77,0) 99%)`, padding: "0.05em 2px", WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" }}>{h}</span></p>
                        <CopyButton text={h} label="" />
                      </div>))}
                    </div>
                  </div>
                  <div className="p-5" style={{ borderRadius: 18, background: C.ink, color: "#fff" }}>
                    <div className="mb-2 flex items-center justify-between"><span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: C.coral }}>DROP THIS IN THE COMMENTS</span><CopyButton text={content.question} /></div>
                    <p style={{ fontFamily: serif, fontSize: 18, lineHeight: 1.4 }}>{content.question}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={genContent} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2" style={{ border: `1px solid ${C.hair}`, fontSize: 13, background: C.surface }}><RotateCw size={14} /> Regenerate</button>
                    <button onClick={() => setTab("creative")} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2" style={{ background: GRAD, color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 6px 16px rgba(91,61,245,0.28)" }}>Make the creative <ArrowRight size={14} /></button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* CREATIVE TAB */}
        {tab === "creative" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-2">
              <div className="p-5" style={cardStyle}>
                <Eyebrow>DESIGN</Eyebrow>
                <Field label="WHAT TO MAKE" tip="A carousel (5 swipeable slides) is the highest-engagement format on LinkedIn in 2026. A static card is one strong image."><Chips options={[{ id: "carousel", label: "Carousel (5 slides)" }, { id: "static", label: "Static card" }]} value={creativeType} onChange={setCreativeType} cols={1} /></Field>
                <div className="mb-4 rounded-xl p-3" style={{ background: C.violetSoft, border: `1px solid ${C.hair}`, fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>Themed with your colors: <b>{brand.primary}</b> background, <b style={{ color: C.coral }}>{brand.accent}</b> accent. Change them in <b>Your Brand</b> up top.</div>
                <PrimaryBtn onClick={genCreative} disabled={crLoading}>{crLoading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{crLoading ? "Designing…" : "Generate creative"}</PrimaryBtn>
                <p className="mt-3" style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Built from your post. Download each slide as a PNG and upload to LinkedIn — carousels go up as a multi-image or document post.</p>
              </div>
            </section>
            <section className="lg:col-span-3">
              {!creative && !crLoading && !crErr && (<div className="flex h-full flex-col justify-center p-8" style={{ ...cardStyle, border: `1.5px dashed ${C.hair}`, boxShadow: "none", minHeight: 340 }}><Eyebrow>PREVIEW</Eyebrow><p style={{ fontFamily: serif, fontSize: 22, lineHeight: 1.3, maxWidth: 400 }}>Your branded slides render here, ready to download.</p></div>)}
              {crLoading && (<div className="flex h-full flex-col items-center justify-center p-8" style={{ ...cardStyle, minHeight: 340 }}><Loader2 size={26} className="animate-spin" style={{ color: C.violet }} /><p style={{ fontFamily: mono, fontSize: 13, color: C.muted, marginTop: 14 }}>Laying out your slides…</p></div>)}
              {crErr && !crLoading && (<div className="p-6" style={cardStyle}><p style={{ fontSize: 15 }}>{crErr}</p><button onClick={genCreative} className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${C.hair}`, fontSize: 13 }}><RotateCw size={14} /> Try again</button></div>)}
              {creative && !crLoading && slides.length > 0 && (
                <div>
                  <Slide id="active-slide" data={slides[slideIdx]} brand={brand} kind={creative.type === "static" ? "static" : slides[slideIdx].kind} />
                  {creative.type === "carousel" && (
                    <div className="mt-3 flex items-center justify-between">
                      <button onClick={() => setSlideIdx((i) => Math.max(0, i - 1))} disabled={slideIdx === 0} className="rounded-xl p-2" style={{ border: `1px solid ${C.hair}`, background: C.surface, opacity: slideIdx === 0 ? 0.4 : 1 }}><ChevronLeft size={16} /></button>
                      <div className="flex gap-1.5">{slides.map((_, i) => <span key={i} onClick={() => setSlideIdx(i)} style={{ width: 9, height: 9, borderRadius: 99, cursor: "pointer", background: i === slideIdx ? C.violet : C.hair }} />)}</div>
                      <button onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))} disabled={slideIdx === slides.length - 1} className="rounded-xl p-2" style={{ border: `1px solid ${C.hair}`, background: C.surface, opacity: slideIdx === slides.length - 1 ? 0.4 : 1 }}><ChevronRight size={16} /></button>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => downloadSlide("active-slide", `slide-${creative.type === "carousel" ? slideIdx + 1 : "static"}.png`)} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2" style={{ background: GRAD, color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 6px 16px rgba(91,61,245,0.28)" }}><Download size={14} /> Download this slide</button>
                    <button onClick={genCreative} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2" style={{ border: `1px solid ${C.hair}`, fontSize: 13, background: C.surface }}><RotateCw size={14} /> Regenerate</button>
                    <span className="ml-auto inline-flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 11, color: C.muted }}><Lock size={12} /> Download all + auto-post — Pro</span>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2" style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 16, fontFamily: mono, fontSize: 11, color: C.muted }}>
          <span>Built by a marketer who codes. No dev queue required.</span><span className="inline-flex items-center gap-1" style={{ color: C.violet }}>Shruti's Brewed Thoughts <ArrowRight size={11} /></span>
        </footer>
      </div>

      {/* ---- Upgrade modal ---- */}
      {showUpgrade && (
        <div onClick={() => setShowUpgrade(false)} style={{ position: "fixed", inset: 0, background: "rgba(23,21,48,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full" style={{ maxWidth: 440, background: C.surface, borderRadius: 22, padding: 26, boxShadow: "0 30px 80px rgba(23,21,48,0.4)" }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: C.coral }}>UPGRADE TO PRO</div>
            <h3 style={{ fontFamily: serif, fontSize: 26, margin: "8px 0 6px", background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{uses >= FREE_LIMIT ? "You've used your free posts" : "Week mode is a Pro feature"}</h3>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>Pro unlocks a full week of content in one go, unlimited posts, and download-all for carousels. Drop your email for early access — or enter your code below.</p>

            {!waitDone ? (
              <div className="flex gap-2" style={{ marginBottom: 14 }}>
                <input value={waitEmail} onChange={(e) => setWaitEmail(e.target.value)} placeholder="you@email.com" className="flex-1 px-3 py-2.5 outline-none" style={{ border: `1.5px solid ${C.hair}`, borderRadius: 12, fontSize: 14, background: C.bg }} />
                <button onClick={joinWaitlist} disabled={!waitEmail.includes("@")} className="rounded-xl px-4 py-2.5" style={{ background: GRAD, color: "#fff", fontWeight: 700, fontSize: 14, opacity: waitEmail.includes("@") ? 1 : 0.5 }}>Notify me</button>
              </div>
            ) : (
              <div className="flex items-center gap-2" style={{ marginBottom: 14, color: C.violet, fontSize: 14 }}><Check size={16} /> You're on the list. Talk soon.</div>
            )}

            <div style={{ borderTop: `1px solid ${C.hair}`, margin: "8px 0 14px" }} />
            <div className="flex gap-2">
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Have an access code?" className="flex-1 px-3 py-2.5 outline-none" style={{ border: `1.5px solid ${C.hair}`, borderRadius: 12, fontSize: 14, background: C.bg }} />
              <button onClick={tryCode} className="rounded-xl px-4 py-2.5" style={{ border: `1px solid ${C.hair}`, fontSize: 14, fontWeight: 600, color: C.violet, background: C.surface }}>Unlock</button>
            </div>

            <button onClick={() => setShowUpgrade(false)} className="mt-4 w-full" style={{ fontFamily: mono, fontSize: 11, color: C.muted, textDecoration: "underline" }}>Maybe later</button>
          </div>
        </div>
      )}
    </div>
  );
}
