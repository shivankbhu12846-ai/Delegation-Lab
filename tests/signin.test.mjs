import { createHandler, memoryStore } from "../netlify/lib/core.mjs";
import assert from "node:assert/strict";
let clock = 2_000_000_000_000;
const h = createHandler({ store: memoryStore(), env: { EXPERIMENTER_PASSWORD: "pw" }, now: () => clock });
const call = async (m, p, b, k) => { const r = await h(new Request("https://x/api" + p, { method: m, headers: k ? { "x-key": k } : {}, body: m === "POST" ? JSON.stringify(b || {}) : undefined })); return { http: r.status, ...(await r.json()) }; };
const st = (c) => call("GET", `/state?code=${c.code}&memberId=${c.memberId}&token=${c.token}`);
const g = await call("POST", "/admin/create", { condition: "group", trial: true }, "pw");
const m = {};
for (const n of ["Agent 1", "Agent 2", "Agent 3", "Agent 4"]) { const r = await call("POST", "/join", { code: g.code, name: n }); assert.equal(r.http, 200); m[n] = { code: g.code, memberId: r.memberId, token: r.token }; }
assert.equal((await call("POST", "/join", { code: g.code, name: "Newcomer" })).http, 409, "group full");
// Check 1: join, leave and rejoin before Start
assert.equal((await call("POST", "/leave", m["Agent 3"])).http, 200);
assert.equal((await st(m["Agent 3"])).http, 401, "left member signed out");
assert.equal((await st(m["Agent 1"])).members.length, 3, "seat freed");
const a3 = await call("POST", "/join", { code: g.code, name: "Agent 3" }); assert.equal(a3.http, 200, "same person rejoins the free seat");
m["Agent 3"] = { code: g.code, memberId: a3.memberId, token: a3.token };
await call("POST", "/leave", m["Agent 3"]);
const nc = await call("POST", "/join", { code: g.code, name: "Newcomer" }); assert.equal(nc.http, 200, "someone else can take the free seat");
await call("POST", "/leave", { code: g.code, memberId: nc.memberId, token: nc.token });
m["Agent 3"] = (({ memberId, token }) => ({ code: g.code, memberId, token }))(await call("POST", "/join", { code: g.code, name: "Agent 3" }));
// Check 2: takeover by name is refused, before and after the start; the real member stays signed in
assert.equal((await call("POST", "/join", { code: g.code, name: "Agent 2" })).http, 409, "takeover refused (lobby)");
assert.equal((await call("POST", "/join", { code: g.code, name: "agent 2" })).http, 409, "takeover refused (other capitalisation)");
assert.equal((await call("POST", "/join", { code: g.code, name: "Agent 2", rejoinCode: "ABCDEF" })).http, 409, "made-up rejoin code refused");
assert.ok(!(await st(m["Agent 2"])).error, "Agent 2 still signed in");
// experimenter can still remove a member before the start
assert.equal((await call("POST", "/admin/remove", { code: g.code, memberId: "agent-4" }, "pw")).http, 200);
assert.equal((await st(m["Agent 4"])).http, 401);
m["Agent 4"] = (({ memberId, token }) => ({ code: g.code, memberId, token }))(await call("POST", "/join", { code: g.code, name: "Agent 4" }));
// Check 3: run the session with all four seats; one member loses their browser mid-session
await call("POST", "/start", m["Agent 1"]); clock += 61_000;
for (const [i, n] of ["Agent 1", "Agent 2", "Agent 3", "Agent 4"].entries()) assert.equal((await call("POST", "/submit", { ...m[n], taskId: g.taskIds[i], text: "work by " + n })).http, 200, n);
await call("POST", "/agent", { ...m["Agent 2"], taskId: g.taskIds[10] });
assert.equal((await call("POST", "/join", { code: g.code, name: "Agent 2" })).http, 409, "takeover refused (mid-session)");
assert.equal((await call("POST", "/leave", m["Agent 1"])).http, 409, "no leaving after the start");
assert.equal((await call("POST", "/join", { code: g.code, name: "Late Person" })).http, 409, "no new people after the start");
// Agent 2's laptop dies: experimenter resets; old sign-in stops working; code works once
const rs = await call("POST", "/admin/reset", { code: g.code, memberId: "agent-2" }, "pw"); assert.equal(rs.http, 200); assert.equal(rs.resetCode.length, 6);
assert.equal((await st(m["Agent 2"])).http, 401, "old sign-in invalid after reset");
assert.equal((await call("POST", "/join", { code: g.code, name: "Agent 2" })).http, 409, "name alone still refused after reset");
assert.equal((await call("POST", "/join", { code: g.code, name: "Agent 3", rejoinCode: rs.resetCode })).http, 409, "code only works for that member");
const back = await call("POST", "/join", { code: g.code, name: "Agent 2", rejoinCode: rs.resetCode.toLowerCase() }); assert.equal(back.http, 200, "rejoin with code");
assert.equal((await call("POST", "/join", { code: g.code, name: "Agent 2", rejoinCode: rs.resetCode })).http, 409, "code is single-use");
const full = await call("GET", `/state?code=${g.code}&memberId=${back.memberId}&token=${back.token}&full=1`);
assert.equal(full.mine.submitted[g.taskIds[1]], "work by Agent 2", "own submission restored");
assert.ok(full.mine.agent[g.taskIds[10]], "own AI draft restored");
assert.equal((await call("POST", "/submit", { code: g.code, memberId: back.memberId, token: back.token, taskId: g.taskIds[11], text: "after rejoin" })).http, 200);
const d = await call("POST", "/admin/data", {}, "pw");
assert.deepEqual(Object.fromEntries(d.subs.map((x) => [x.taskId, x.memberId])), { [g.taskIds[0]]: "agent-1", [g.taskIds[1]]: "agent-2", [g.taskIds[2]]: "agent-3", [g.taskIds[3]]: "agent-4", [g.taskIds[11]]: "agent-2" }, "every task credited to the right person");
assert.equal(d.members.find((x) => x.memberId === "agent-2").rejoins, 1);
assert.equal(d.members.find((x) => x.memberId === "agent-2").resetCode, null);
assert.ok(d.members.every((x) => !("token" in x)), "tokens never sent to the dashboard");
// individual session
const i = await call("POST", "/admin/create", { condition: "individual" }, "pw");
const a = await call("POST", "/join", { code: i.code, name: "Asha" });
assert.equal((await call("POST", "/join", { code: i.code, name: "Ben" })).http, 409);
assert.equal((await call("POST", "/join", { code: i.code, name: "Asha" })).http, 409, "individual takeover refused");
await call("POST", "/leave", { code: i.code, memberId: a.memberId, token: a.token });
assert.equal((await call("POST", "/join", { code: i.code, name: "Ben" })).http, 200, "seat free after leaving");
console.log("LEAVE / TAKEOVER / RESET TESTS PASSED (34 checks)");
