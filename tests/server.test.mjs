import { createHandler, memoryStore, editStats } from "../netlify/lib/core.mjs";
import assert from "node:assert/strict";

let clock = 1_800_000_000_000;
const store = memoryStore();
// Fake model: echoes which version it was asked for, so we can check the planted-error instruction
const fakeFetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  const weak = body.messages[0].content.includes("Include exactly one error");
  return new Response(JSON.stringify({ content: [{ type: "text", text: weak ? "LIVE WEAK draft" : "LIVE STRONG draft text here" }] }), { status: 200 });
};
const env = { EXPERIMENTER_PASSWORD: "pw", GRADER_PASSWORD: "gpw", AI_API_KEY: "k" };
const h = createHandler({ store, env, now: () => clock, fetchImpl: fakeFetch });
async function call(method, path, body, key) {
  const init = { method, headers: { "content-type": "application/json", ...(key ? { "x-key": key } : {}) } };
  if (body && method === "POST") init.body = JSON.stringify(body);
  const r = await h(new Request("https://x.test/api" + path, init));
  return { status: r.status, ...(await r.json()) };
}

// auth
assert.equal((await call("POST", "/admin/check", {}, "nope")).status, 401);
assert.equal((await call("POST", "/admin/check", {}, "pw")).status, 200);

// individual session
const ind = await call("POST", "/admin/create", { condition: "individual", label: "P01", trial: false }, "pw");
assert.equal(ind.taskIds.length, 10);
const ad = await call("POST", "/join", { code: ind.code.toLowerCase(), name: "Asha Rao" });
assert.equal(ad.status, 200);
assert.equal((await call("POST", "/join", { code: ind.code, name: "Someone Else" })).status, 409, "individual session full");
assert.equal((await call("POST", "/join", { code: ind.code, name: "Asha Rao", token: ad.token })).status, 200, "rejoin with token");
assert.equal((await call("POST", "/join", { code: ind.code, name: "asha rao" })).status, 409, "same name without token is refused");
const cA = { code: ind.code, memberId: ad.memberId, token: ad.token };
let st = await call("GET", `/state?code=${ind.code}&memberId=${cA.memberId}&token=${cA.token}`);
assert.equal(st.phase, "lobby"); assert.equal(st.tasks, undefined);
assert.equal((await call("POST", "/agent", { ...cA, taskId: ind.taskIds[0] })).status, 409, "no agent in lobby");
assert.equal((await call("POST", "/start", cA)).status, 200);
st = await call("GET", `/state?code=${ind.code}&memberId=${cA.memberId}&token=${cA.token}&full=1`);
assert.equal(st.phase, "preview"); assert.equal(st.tasks.length, 10);
assert.ok(st.tasks[0].context.includes("you") && !st.tasks[0].context.includes("your department"));
assert.ok(!("answer" in st.tasks[0]) && !("flaw" in st.tasks[0]), "no secrets sent");
assert.equal((await call("POST", "/submit", { ...cA, taskId: ind.taskIds[0], text: "x" })).status, 409, "no submit in preview");
clock += 61_000;
st = await call("GET", `/state?code=${ind.code}&memberId=${cA.memberId}&token=${cA.token}`);
assert.equal(st.phase, "work");
// AI on two tasks: one submitted unedited, one edited; one task own work
const weakIdx = ind.taskIds.findIndex((id) => ind.weak.includes(id));
const t0 = ind.taskIds[0], t1 = ind.taskIds[1], t2 = ind.taskIds[2];
const a0 = await call("POST", "/agent", { ...cA, taskId: t0 });
assert.ok(a0.text.startsWith("LIVE"));
assert.equal((await call("POST", "/agent", { ...cA, taskId: t0 })).text, a0.text, "second call returns same draft");
clock += 20_000;
assert.equal((await call("POST", "/submit", { ...cA, taskId: t0, text: a0.text })).status, 200);
assert.equal((await call("POST", "/submit", { ...cA, taskId: t0, text: "again" })).status, 409);
const a1 = await call("POST", "/agent", { ...cA, taskId: t1 });
assert.equal((await call("POST", "/submit", { ...cA, taskId: t1, text: a1.text + " Plus my own extra sentence." })).status, 200);
assert.equal((await call("POST", "/submit", { ...cA, taskId: t2, text: "My own answer." })).status, 200);
assert.equal((await call("POST", "/submit", { ...cA, taskId: "T99", text: "x" })).status, 400);
console.log("weak tasks in individual session:", ind.weak.length, "(index", weakIdx, ")");

// group session
const grp = await call("POST", "/admin/create", { condition: "group", label: "G1", trial: true }, "pw");
assert.equal(grp.taskIds.length, 40); assert.equal(grp.weak.length, 10, "exactly 10 planted errors in 40");
const names = ["Priya", "Rahul", "Mei", "Jonas"]; const g = [];
for (const n of names) { const r = await call("POST", "/join", { code: grp.code, name: n }); assert.equal(r.status, 200, n); g.push({ code: grp.code, memberId: r.memberId, token: r.token }); }
assert.equal((await call("POST", "/join", { code: grp.code, name: "Fifth" })).status, 409, "group full");
st = await call("GET", `/state?code=${grp.code}&memberId=${g[0].memberId}&token=${g[0].token}`);
assert.equal(st.members.length, 4);
await call("POST", "/start", g[2]);
clock += 61_000;
const gt = grp.taskIds;
const r0 = await call("POST", "/agent", { ...g[0], taskId: gt[0] });
const r1 = await call("POST", "/agent", { ...g[1], taskId: gt[0] }); // two members ask AI on same task
await call("POST", "/submit", { ...g[0], taskId: gt[0], text: r0.text });
assert.equal((await call("POST", "/submit", { ...g[1], taskId: gt[0], text: r1.text })).status, 409, "first submission wins");
assert.equal((await call("POST", "/agent", { ...g[2], taskId: gt[0] })).status, 409, "no agent after submission");
await call("POST", "/submit", { ...g[3], taskId: gt[1], text: "Own work by Jonas" });
st = await call("GET", `/state?code=${grp.code}&memberId=${g[1].memberId}&token=${g[1].token}&full=1`);
assert.deepEqual(st.status[gt[0]].ai.sort(), ["Priya", "Rahul"]);
assert.equal(st.status[gt[0]].by, "Priya"); assert.equal(st.status[gt[1]].by, "Jonas");
assert.ok(st.tasks[0].context.includes("your department"));
assert.equal(st.mine.agent[gt[0]], r1.text, "Rahul sees his unsubmitted AI draft after refresh");

// time up
clock += 610_000;
assert.equal((await call("POST", "/submit", { ...g[3], taskId: gt[5], text: "late" })).status, 409, "late submission refused");

// grading: blind, labels map to -2..2
assert.equal((await call("POST", "/grade/next", { judge: "Grader One" }, "wrong")).status, 401);
let n = await call("POST", "/grade/next", { judge: "Grader One" }, "gpw");
assert.equal(n.progress.total, 5);
const leaks = JSON.stringify(n);
assert.ok(!/condition|memberId|aiUsed|agent|group|weak|version|code/.test(leaks.replace(/"context":"[^"]*"/, "")), "grader payload is blind: " + leaks);
let graded = 0;
while (!n.empty) { assert.equal((await call("POST", "/grade/rate", { judge: "Grader One", ref: n.ref, score: graded % 5 - 2 }, "gpw")).status, 200); graded++; n = await call("POST", "/grade/next", { judge: "Grader One" }, "gpw"); }
assert.equal(graded, 5);
assert.equal((await call("POST", "/grade/rate", { judge: "Grader One", ref: "nope", score: 1 }, "gpw")).status, 404);

// experimenter data
let d = await call("POST", "/admin/data", {}, "pw");
assert.equal(d.sessions.length, 2); assert.equal(d.members.length, 5); assert.equal(d.subs.length, 5); assert.equal(d.ratings.length, 5);
assert.ok(d.members.every((m) => !("token" in m)), "tokens not exposed");
const s0 = d.subs.find((s) => s.taskId === t0 && s.code === ind.code), s1 = d.subs.find((s) => s.taskId === t1 && s.code === ind.code);
assert.equal(s0.aiUsed, true); assert.equal(s0.edited, false); assert.equal(s0.editRatio, 0); assert.equal(s0.agentSource, "live");
assert.equal(s1.edited, true); assert.ok(s1.editRatio > 0 && s1.wordsAdded === 5 && s1.wordsRemoved === 0, JSON.stringify(s1));
const own = d.subs.find((s) => s.taskId === t2 && s.code === ind.code); assert.equal(own.aiUsed, false);
const rahulAg = d.agents.find((a) => a.memberId === "rahul"); assert.ok(rahulAg, "unsubmitted AI call is recorded");
const live = d.agents.find((a) => a.code === grp.code && grp.weak.includes(a.taskId));
if (live) assert.equal(live.text, "LIVE WEAK draft");

// prepared mode fallback when the model fails
const h2 = createHandler({ store, env: { ...env }, now: () => clock, fetchImpl: async () => { throw new Error("boom"); } });
const s3 = await call("POST", "/admin/create", { condition: "individual" }, "pw");
const j3 = await (await h2(new Request("https://x.test/api/join", { method: "POST", body: JSON.stringify({ code: s3.code, name: "Zed" }) }))).json();
await call("POST", "/admin/start", { code: s3.code }, "pw"); clock += 61_000;
const fb = await (await h2(new Request("https://x.test/api/agent", { method: "POST", body: JSON.stringify({ code: s3.code, memberId: j3.memberId, token: j3.token, taskId: s3.taskIds[0] }) }))).json();
d = await call("POST", "/admin/data", {}, "pw");
const fbRec = d.agents.find((a) => a.code === s3.code);
assert.equal(fbRec.source, "prepared"); assert.equal(fbRec.fallback, "boom"); assert.ok(fb.text.length > 10);

// settings
const set = await call("POST", "/admin/settings", { settings: { plantedErrors: false, agentMode: "prepared", previewSec: 10, workSec: 120, maxPayout: 200 } }, "pw");
assert.deepEqual(set.settings, { plantedErrors: false, agentMode: "prepared", previewSec: 10, workSec: 120, maxPayout: 200 });
const s4 = await call("POST", "/admin/create", { condition: "group" }, "pw");
assert.equal(s4.weak.length, 0); assert.equal(s4.settings.workSec, 120);

// delete one session (the trial group), then everything
const before = Object.keys(store.dump()).length;
await call("POST", "/admin/delete", { codes: [grp.code] }, "pw");
const left = Object.keys(store.dump());
assert.ok(!left.some((k) => k.includes(grp.code)), "no keys left for deleted session");
assert.ok(left.some((k) => k.includes(ind.code)), "other sessions kept");
console.log("keys before/after single delete:", before, left.length);
await call("POST", "/admin/delete", { all: true }, "pw");
assert.deepEqual(Object.keys(store.dump()), ["config/settings"]);

// edit stats sanity
console.log(editStats("Hello there team", "Hello there team"), editStats("a b c d", "a x c d e"));
console.log("ALL SERVER TESTS PASSED");
