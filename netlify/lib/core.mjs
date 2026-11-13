// Delegation Lab – server logic.
// Runs inside the Netlify Function (netlify/functions/api.mjs) with Netlify Blobs as storage.
// The same code also runs in the browser for the demo page, with an in-memory store.

import { TASKS } from "./tasks.mjs";

export const DEFAULTS = { plantedErrors: true, agentMode: "live", previewSec: 60, workSec: 600 };
const INDIVIDUAL_TASKS = 10;
const GROUP_SIZE = 4;
const GRACE_MS = 5000; // network allowance at the end of the clock
const MODEL_TIMEOUT_MS = 25000;
const TASK = Object.fromEntries(TASKS.map((t) => [t.id, t]));

/* ---------------- small helpers ---------------- */
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function rand(n, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789") {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const r = new Uint32Array(1); crypto.getRandomValues(r);
    const j = r[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const cleanName = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
const slug = (s) => cleanName(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const normCode = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
const normText = (s) => String(s ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();

async function pmap(items, fn, limit = 24) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/* ---------------- edit extent ---------------- */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Uint32Array(b.length + 1), cur = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i; const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}
function lcsLength(a, b) {
  let prev = new Uint32Array(b.length + 1), cur = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev]; cur.fill(0);
  }
  return prev[b.length];
}
export function editStats(aiText, finalText) {
  const A = normText(aiText).slice(0, 6000), B = normText(finalText).slice(0, 6000);
  const dist = levenshtein(A, B);
  const longest = Math.max(A.length, B.length);
  const wa = A ? A.split(/\s+/) : [], wb = B ? B.split(/\s+/) : [];
  const common = lcsLength(wa, wb);
  return {
    edited: A !== B,
    editChars: dist,
    editRatio: longest ? Math.round((dist / longest) * 10000) / 10000 : 0,
    wordsRemoved: wa.length - common,
    wordsAdded: wb.length - common,
  };
}

/* ---------------- tasks ---------------- */
export function publicTask(t, condition) {
  return {
    id: t.id, kind: t.kind, title: t.title, prompt: t.prompt, materials: t.materials,
    context: t.context.replace("{you}", condition === "group" ? "your department" : "you"),
  };
}
export function preparedText(t, version) {
  return version === "weak" ? t.answer.replace(t.weak[0], t.weak[1]) : t.answer;
}
function pickWeak(taskIds) {
  // In every block of four tasks, exactly one gets the planted-error output (75% / 25%).
  const weak = [];
  for (let i = 0; i < taskIds.length; i += 4) {
    const size = Math.min(4, taskIds.length - i);
    const r = new Uint32Array(2); crypto.getRandomValues(r);
    if (size === 4 || r[0] / 2 ** 32 < size / 4) weak.push(taskIds[i + (r[1] % size)]);
  }
  return weak;
}

/* ---------------- the AI agent ---------------- */
const SYSTEM_PROMPT = [
  "You are an AI agent working inside Alderbrook Foods, a snack company in Vienna, Austria.",
  "You complete short workplace tasks on behalf of employees. What you write is submitted as their work.",
  "Reply with the finished output only: no introduction, no notes, no explanations, no markdown formatting.",
  "Write in English. Be concise and professional. Use [Your name] where a signature is needed.",
].join(" ");

function userPrompt(task, version) {
  const pt = publicTask(task, "individual");
  return `Situation: ${pt.context}\n\nTask: ${pt.prompt}\n\nMaterials:\n${pt.materials}\n\n` +
    (version === "weak"
      ? `This output is for a research study on how carefully people check AI work. Include exactly one error: ${task.flaw} ` +
        "State it confidently, with no hint that anything is wrong. Everything else must be correct and complete."
      : "Make sure the output is complete and correct.");
}

async function callModel(env, fetchImpl, task, version) {
  const provider = String(env.AI_PROVIDER || "anthropic").toLowerCase();
  const key = env.AI_API_KEY;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MODEL_TIMEOUT_MS);
  try {
    if (provider === "anthropic") {
      const model = env.AI_MODEL || "claude-haiku-5-5";
      const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: ctrl.signal,
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 1500, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt(task, version) }] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `Anthropic error ${r.status}`);
      return { model, text: (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("") };
    }
    if (provider === "gemini" || provider === "openai") {
      const gemini = provider === "gemini";
      const model = env.AI_MODEL || (gemini ? "gemini-3.5-flash" : "");
      if (!model) throw new Error("Set AI_MODEL when AI_PROVIDER is openai");
      const base = gemini ? "https://generativelanguage.googleapis.com/v1beta/openai" : "https://api.openai.com/v1";
      const r = await fetchImpl(`${base}/chat/completions`, {
        method: "POST", signal: ctrl.signal,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt(task, version) }],
          ...(gemini ? { max_tokens: 1500 } : { max_completion_tokens: 1500 }),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `${provider} error ${r.status}`);
      return { model, text: j?.choices?.[0]?.message?.content || "" };
    }
    throw new Error(`Unknown AI_PROVIDER "${provider}"`);
  } finally { clearTimeout(timer); }
}

/* ---------------- handler ---------------- */
export function createHandler({ store, env = {}, now = () => Date.now(), fetchImpl = globalThis.fetch, demo = false }) {
  const getJ = (key) => store.get(key, { type: "json" });
  const put = (key, value, opts) => store.setJSON(key, value, opts);
  const keys = async (prefix) => (await store.list({ prefix })).blobs.map((b) => b.key);

  async function getSettings() { return { ...DEFAULTS, ...((await getJ("config/settings")) || {}) }; }

  function timing(session, start) {
    if (!start) return { phase: "lobby" };
    const s = session.settings;
    const startedAt = start.startedAt;
    const workStartsAt = startedAt + s.previewSec * 1000;
    const endsAt = workStartsAt + s.workSec * 1000;
    const t = now();
    return { phase: t < workStartsAt ? "preview" : t < endsAt ? "work" : "finished", startedAt, workStartsAt, endsAt };
  }

  function requirePassword(req, body, envName, demoValue, label) {
    const expected = demo ? demoValue : env[envName];
    if (!expected) fail(503, `The ${label} password isn't set up. Add ${envName} in Netlify's environment variables, then redeploy.`);
    const given = req.headers.get("x-key") || body.key;
    if (given !== expected) fail(401, `Wrong ${label} password.`);
  }

  async function loadSession(codeIn) {
    const code = normCode(codeIn);
    const session = code && (await getJ(`session/${code}`));
    if (!session) fail(404, "There's no session with that code. Check the code with the experimenter.");
    return { code, session };
  }
  async function asMember(src) {
    const { code, session } = await loadSession(src.code);
    const me = src.memberId && (await getJ(`member/${code}/${slug(src.memberId)}`));
    if (!me || me.token !== src.token) fail(401, "You're signed out of this session. To carry on, join again with the same code and the same name.");
    return { code, session, me };
  }
  async function removeMember(code, memberId) {
    const slots = await keys(`slot/${code}/`);
    const owned = (await pmap(slots, getJ)).map((v, i) => (v && v.memberId === memberId ? slots[i] : null)).filter(Boolean);
    await pmap([`member/${code}/${memberId}`, ...owned], (k) => store.delete(k));
  }
  async function members(code) {
    const list = await pmap(await keys(`member/${code}/`), getJ);
    return list.filter(Boolean).sort((a, b) => a.joinedAt - b.joinedAt).map(({ memberId, name, joinedAt }) => ({ memberId, name, joinedAt }));
  }
  async function deleteSessionData(code) {
    const subKeys = await keys(`sub/${code}/`);
    const subs = await pmap(subKeys, getJ);
    const all = [
      `session/${code}`, `start/${code}`,
      ...(await keys(`member/${code}/`)), ...(await keys(`slot/${code}/`)), ...(await keys(`agent/${code}/`)),
      ...subKeys, ...(await keys(`done/${code}/`)), ...(await keys(`rating/${code}/`)), ...(await keys(`finish/${code}/`)),
      ...subs.filter(Boolean).map((s) => `ref/${s.id}`),
    ];
    await pmap(all, (k) => store.delete(k));
    return all.length;
  }

  // A session is closed when time is up, every task is submitted, or every member has pressed Finish.
  async function isClosed(code, session, start) {
    if (!start) return false;
    if (now() > timing(session, start).endsAt + GRACE_MS) return true;
    const [done, fin, mem] = await Promise.all([keys(`done/${code}/`), keys(`finish/${code}/`), keys(`member/${code}/`)]);
    return done.length >= session.taskIds.length || (mem.length > 0 && fin.length >= mem.length);
  }
  async function refuseIfFinished(code, me) {
    if (await getJ(`finish/${code}/${me.memberId}`)) fail(409, "You've already finished this session, so you can't do more tasks.");
  }

  async function runAgent(task, version, session) {
    const prepared = (fallback) => ({ text: preparedText(task, version), source: "prepared", model: "", ...(fallback ? { fallback } : {}) });
    if (demo || session.settings.agentMode === "prepared") return prepared();
    if (!env.AI_API_KEY) return prepared("AI_API_KEY is not set");
    try {
      const { text, model } = await callModel(env, fetchImpl, task, version);
      const clean = String(text || "").replace(/^```[a-z]*\n?|```$/g, "").trim();
      if (!clean) throw new Error("The model returned no text");
      return { text: clean.slice(0, 6000), source: "live", model };
    } catch (e) {
      return prepared(String(e?.name === "AbortError" ? "Model timed out" : e?.message || e).slice(0, 200));
    }
  }

  const routes = {
    /* ---------- general ---------- */
    "GET /health": async () => ({ ok: true, demo }),

    /* ---------- participants ---------- */
    "POST /join": async (b) => {
      const { code, session } = await loadSession(b.code);
      const name = cleanName(b.name);
      const memberId = slug(name);
      if (!memberId) fail(400, "Enter your name, using letters or numbers.");
      const key = `member/${code}/${memberId}`;
      const existing = await getJ(key);
      if (existing) {
        // Rejoining with the same name (closed the tab, switched device, signed out): issue a fresh sign-in.
        // Any other device still signed in under this name is signed out.
        const token = b.token && b.token === existing.token ? existing.token : rand(24);
        if (token !== existing.token) await put(key, { ...existing, token, rejoins: (existing.rejoins || 0) + 1, lastRejoinAt: now() });
        return { code, memberId, name: existing.name, token, rejoined: token !== b.token };
      }
      if (await getJ(`start/${code}`)) fail(409, "This session has already started. Only people who joined before the start can come back, using the same name as before.");
      const rec = { memberId, name, token: rand(24), joinedAt: now() };
      if (!(await put(key, rec, { onlyIfNew: true })).modified) fail(409, "Someone with that name has just joined. If that wasn't you, add your surname or an initial.");
      for (let i = 0; i < session.size; i++) {
        if ((await put(`slot/${code}/${i}`, { memberId }, { onlyIfNew: true })).modified) {
          await put(key, { ...rec, slot: i });
          return { code, memberId, name, token: rec.token };
        }
      }
      await store.delete(key);
      fail(409, session.size === 1
        ? "Someone else has already joined this individual session. If that was you, use the same name as before."
        : "This group already has four members. If you were one of them, use the same name as before.");
    },

    "POST /leave": async (b) => {
      const { code, me } = await asMember(b);
      if (await getJ(`start/${code}`)) fail(409, "The session has started, so you can't leave the group now. Press I'm done when you've finished.");
      await removeMember(code, me.memberId);
      return { ok: true };
    },

    "GET /state": async (_, q) => {
      const { code, session, me } = await asMember(q);
      const [mem, start, agentKeys, doneKeys, finKeys] = await Promise.all([
        members(code), getJ(`start/${code}`), keys(`agent/${code}/`), keys(`done/${code}/`), keys(`finish/${code}/`),
      ]);
      const finishedIds = finKeys.map((k) => k.split("/")[2]);
      const tm = timing(session, start);
      const nameOf = (id) => mem.find((m) => m.memberId === id)?.name || id;
      const status = {};
      for (const k of agentKeys) { const [, , taskId, mid] = k.split("/"); (status[taskId] ||= {}).ai = [...(status[taskId].ai || []), nameOf(mid)]; }
      for (const k of doneKeys) { const [, , taskId, mid] = k.split("/"); (status[taskId] ||= {}).by = nameOf(mid); status[taskId].mine = mid === me.memberId; }
      const out = {
        now: now(), code, condition: session.condition, size: session.size,
        plantedErrors: session.settings.plantedErrors, previewSec: session.settings.previewSec, workSec: session.settings.workSec,
        tasksPerPerson: INDIVIDUAL_TASKS, totalTasks: session.taskIds.length,
        me: { memberId: me.memberId, name: me.name, finished: finishedIds.includes(me.memberId) }, members: mem, ...tm, status,
        finished: finishedIds.map(nameOf), allSubmitted: doneKeys.length >= session.taskIds.length,
      };
      if (out.me.finished) out.me.finish = await getJ(`finish/${code}/${me.memberId}`);
      if (tm.phase !== "lobby") out.tasks = session.taskIds.map((id) => publicTask(TASK[id], session.condition));
      if (q.full === "1" && tm.phase !== "lobby") {
        const mineAgent = agentKeys.filter((k) => k.endsWith(`/${me.memberId}`));
        const mineDone = doneKeys.filter((k) => k.endsWith(`/${me.memberId}`)).map((k) => `sub/${code}/${k.split("/")[2]}`);
        const [ag, subs] = await Promise.all([pmap(mineAgent, getJ), pmap(mineDone, getJ)]);
        out.mine = {
          agent: Object.fromEntries(ag.filter(Boolean).map((a) => [a.taskId, a.text])),
          submitted: Object.fromEntries(subs.filter(Boolean).map((s) => [s.taskId, s.text])),
        };
      }
      return out;
    },

    "POST /start": async (b) => {
      const { code, session } = await asMember(b);
      const mem = await members(code);
      if (mem.length < session.size) fail(409, `Waiting for ${session.size - mem.length} more ${session.size - mem.length === 1 ? "member" : "members"} to join.`);
      await put(`start/${code}`, { startedAt: now(), by: slug(b.memberId) }, { onlyIfNew: true });
      return { ok: true };
    },

    "POST /finish": async (b) => {
      const { code, session, me } = await asMember(b);
      const tm = timing(session, await getJ(`start/${code}`));
      if (tm.phase === "lobby") fail(409, "The session hasn't started yet.");
      const t = now();
      await put(`finish/${code}/${me.memberId}`, { at: t, secLeft: Math.max(0, Math.round((tm.endsAt - t) / 1000)) }, { onlyIfNew: true });
      return { ok: true, finish: await getJ(`finish/${code}/${me.memberId}`) };
    },

    "POST /agent": async (b) => {
      const { code, session, me } = await asMember(b);
      await refuseIfFinished(code, me);
      const tm = timing(session, await getJ(`start/${code}`));
      if (tm.phase === "lobby" || tm.phase === "preview") fail(409, "The AI agent opens when the reading minute ends.");
      if (now() > tm.endsAt + GRACE_MS) fail(409, "Time is up.");
      const taskId = String(b.taskId || "");
      if (!session.taskIds.includes(taskId)) fail(400, "That task isn't part of this session.");
      if (await getJ(`sub/${code}/${taskId}`)) fail(409, "This task has already been submitted.");
      const key = `agent/${code}/${taskId}/${me.memberId}`;
      const existing = await getJ(key);
      if (existing) return { text: existing.text };
      const version = session.weak.includes(taskId) ? "weak" : "strong";
      const requestedAt = now();
      const out = await runAgent(TASK[taskId], version, session);
      const rec = { code, taskId, memberId: me.memberId, version, ...out, requestedAt, respondedAt: now() };
      if (!(await put(key, rec, { onlyIfNew: true })).modified) return { text: (await getJ(key)).text };
      return { text: rec.text };
    },

    "POST /submit": async (b) => {
      const { code, session, me } = await asMember(b);
      await refuseIfFinished(code, me);
      const tm = timing(session, await getJ(`start/${code}`));
      if (tm.phase === "lobby" || tm.phase === "preview") fail(409, "Answers open when the reading minute ends.");
      if (now() > tm.endsAt + GRACE_MS) fail(409, "Time is up, so this answer wasn't counted.");
      const taskId = String(b.taskId || "");
      if (!session.taskIds.includes(taskId)) fail(400, "That task isn't part of this session.");
      const text = String(b.text ?? "").slice(0, 8000);
      if (!text.trim()) fail(400, "Write an answer or ask the AI agent before submitting.");
      const [ag, agentKeys] = await Promise.all([getJ(`agent/${code}/${taskId}/${me.memberId}`), keys(`agent/${code}/${taskId}/`)]);
      const t = now();
      const rec = {
        id: rand(16), code, condition: session.condition, taskId, memberId: me.memberId, text,
        version: session.weak.includes(taskId) ? "weak" : "strong",
        submittedAt: t, secIntoWork: Math.round((t - tm.workStartsAt) / 1000),
        aiUsed: !!ag,
        teamAiUsed: agentKeys.some((k) => !k.endsWith(`/${me.memberId}`)),
      };
      if (ag) Object.assign(rec, { agentText: ag.text, agentSource: ag.source, reviewSec: Math.round((t - ag.respondedAt) / 1000), ...editStats(ag.text, text) });
      if (!(await put(`sub/${code}/${taskId}`, rec, { onlyIfNew: true })).modified) {
        fail(409, "Another member of your group has already submitted this task.");
      }
      await Promise.all([put(`done/${code}/${taskId}/${me.memberId}`, { at: t }), put(`ref/${rec.id}`, { code, taskId })]);
      if ((await keys(`done/${code}/`)).length >= session.taskIds.length) {
        // Every task is submitted: record the finish (and time left) for everyone in the session
        const fin = { at: t, secLeft: Math.max(0, Math.round((tm.endsAt - t) / 1000)), reason: "all tasks submitted" };
        await pmap(await keys(`member/${code}/`), (k) => put(`finish/${code}/${k.split("/")[2]}`, fin, { onlyIfNew: true }));
      }
      return { ok: true, submittedAt: t };
    },

    /* ---------- graders ---------- */
    "POST /grade/next": async (b, q, req) => {
      requirePassword(req, b, "GRADER_PASSWORD", "grader", "grader");
      const judge = slug(b.judge);
      if (!judge) fail(400, "Enter your grader name.");
      const sessionKeys = await keys("session/");
      const finished = new Set();
      await pmap(sessionKeys, async (k) => {
        const code = k.split("/")[1];
        const [session, start] = await Promise.all([getJ(k), getJ(`start/${code}`)]);
        if (session && (await isClosed(code, session, start))) finished.add(code);
      });
      const subKeys = (await keys("sub/")).filter((k) => finished.has(k.split("/")[1]));
      const rated = new Set((await keys("rating/")).filter((k) => k.split("/")[3] === judge).map((k) => k.split("/").slice(1, 3).join("/")));
      const todo = subKeys.filter((k) => !rated.has(k.split("/").slice(1).join("/")));
      const progress = { done: subKeys.length - todo.length, total: subKeys.length };
      if (!todo.length) return { empty: true, progress };
      todo.sort((x, y) => hash(judge + x) - hash(judge + y));
      const sub = await getJ(todo[0]);
      return { ref: sub.id, task: publicTask(TASK[sub.taskId], "individual"), text: sub.text, progress };
    },

    "POST /grade/rate": async (b, q, req) => {
      requirePassword(req, b, "GRADER_PASSWORD", "grader", "grader");
      const judge = cleanName(b.judge), js = slug(b.judge);
      if (!js) fail(400, "Enter your grader name.");
      const score = Number(b.score);
      if (![-2, -1, 0, 1, 2].includes(score)) fail(400, "Pick one of the five ratings.");
      const ref = await getJ(`ref/${String(b.ref || "")}`);
      if (!ref) fail(404, "That submission no longer exists. It may have been deleted.");
      await put(`rating/${ref.code}/${ref.taskId}/${js}`, { subId: b.ref, code: ref.code, taskId: ref.taskId, judge, judgeId: js, score, ratedAt: now() });
      return { ok: true };
    },

    /* ---------- experimenter ---------- */
    "POST /admin/check": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      return { ok: true, demo, settings: await getSettings(), liveModel: !demo && !!env.AI_API_KEY, provider: env.AI_PROVIDER || "anthropic" };
    },

    "POST /admin/settings": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      const s = b.settings || {};
      const clamp = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
      const next = {
        plantedErrors: !!s.plantedErrors,
        agentMode: s.agentMode === "prepared" ? "prepared" : "live",
        previewSec: clamp(s.previewSec, 0, 600, DEFAULTS.previewSec),
        workSec: clamp(s.workSec, 30, 7200, DEFAULTS.workSec),
      };
      await put("config/settings", next);
      return { settings: next };
    },

    "POST /admin/create": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      const condition = b.condition === "group" ? "group" : "individual";
      const settings = await getSettings();
      const all = shuffle(TASKS.map((t) => t.id));
      const taskIds = condition === "group" ? all : all.slice(0, INDIVIDUAL_TASKS);
      const session = {
        condition, size: condition === "group" ? GROUP_SIZE : 1,
        label: cleanName(b.label), trial: !!b.trial, createdAt: now(),
        settings, taskIds, weak: settings.plantedErrors ? pickWeak(taskIds) : [],
      };
      for (let tries = 0; tries < 8; tries++) {
        const code = rand(6, ALPHA);
        if ((await put(`session/${code}`, { code, ...session }, { onlyIfNew: true })).modified) return { code, ...session };
      }
      fail(500, "Couldn't create a session code. Try again.");
    },

    "POST /admin/start": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      const { code } = await loadSession(b.code);
      if (!(await members(code)).length) fail(409, "Nobody has joined this session yet.");
      await put(`start/${code}`, { startedAt: now(), by: "experimenter" }, { onlyIfNew: true });
      return { ok: true };
    },

    "POST /admin/remove": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      const { code } = await loadSession(b.code);
      if (await getJ(`start/${code}`)) fail(409, "This session has started, so members can't be removed. Their data is part of the session.");
      await removeMember(code, slug(b.memberId));
      return { ok: true };
    },

    "POST /admin/trial": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      const { code, session } = await loadSession(b.code);
      await put(`session/${code}`, { ...session, trial: !!b.trial });
      return { ok: true };
    },

    "POST /admin/delete": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      if (b.all === true) {
        const all = (await keys("")).filter((k) => !k.startsWith("config/"));
        await pmap(all, (k) => store.delete(k));
        return { deletedSessions: (all.filter((k) => k.startsWith("session/"))).length };
      }
      const codes = (Array.isArray(b.codes) ? b.codes : []).map(normCode).filter(Boolean);
      for (const code of codes) await deleteSessionData(code);
      return { deletedSessions: codes.length };
    },

    "POST /admin/data": async (b, q, req) => {
      requirePassword(req, b, "EXPERIMENTER_PASSWORD", "admin", "experimenter");
      const [sessionKeys, memberKeys, agentKeys, subKeys, ratingKeys, finishKeys] = await Promise.all(
        ["session/", "member/", "agent/", "sub/", "rating/", "finish/"].map(keys));
      const [sessions, mem, agents, subs, ratings, fins] = await Promise.all(
        [sessionKeys, memberKeys, agentKeys, subKeys, ratingKeys, finishKeys].map((ks) => pmap(ks, getJ)));
      const starts = await pmap(sessionKeys, (k) => getJ(`start/${k.split("/")[1]}`));
      return {
        now: now(), demo, settings: await getSettings(),
        sessions: sessions.map((s, i) => s && { ...s, ...timing(s, starts[i]) }).filter(Boolean),
        members: mem.map((m, i) => m && ({ code: memberKeys[i].split("/")[1], memberId: m.memberId, name: m.name, joinedAt: m.joinedAt, rejoins: m.rejoins || 0 })).filter(Boolean),
        agents: agents.filter(Boolean),
        subs: subs.filter(Boolean),
        ratings: ratings.filter(Boolean),
        finishes: fins.map((f, i) => f && { code: finishKeys[i].split("/")[1], memberId: finishKeys[i].split("/")[2], ...f }).filter(Boolean),
      };
    },
  };

  return async function handle(req) {
    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
      const route = routes[`${req.method} ${path}`];
      if (!route) return json({ error: "Not found." }, 404);
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      return json(await route(body || {}, Object.fromEntries(url.searchParams), req));
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something went wrong on the server. Try again." }, 500);
    }
  };
}

/* In-memory store with the same interface as Netlify Blobs (used by the demo page and tests). */
export function memoryStore(initial = {}, onChange = () => {}) {
  const m = new Map(Object.entries(initial));
  return {
    async get(key) { return m.has(key) ? JSON.parse(m.get(key)) : null; },
    async setJSON(key, value, opts = {}) {
      if (opts.onlyIfNew && m.has(key)) return { modified: false };
      m.set(key, JSON.stringify(value)); onChange(m); return { modified: true, etag: "x" };
    },
    async delete(key) { m.delete(key); onChange(m); },
    async list({ prefix = "" } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key, etag: "x" })), directories: [] }; },
    dump() { return Object.fromEntries(m); },
  };
}
