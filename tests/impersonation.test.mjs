// Security regression test (see BUILD_LOG.md, 13 Nov 2026): typing a teammate's name must never sign you in as them.
import { createHandler, memoryStore } from "../netlify/lib/core.mjs";
import assert from "node:assert/strict";
let clock = 2_100_000_000_000;
const h = createHandler({ store: memoryStore(), env: { EXPERIMENTER_PASSWORD: "pw" }, now: () => clock });
const call = async (m, p, b, k) => { const r = await h(new Request("https://x/api" + p, { method: m, headers: k ? { "x-key": k } : {}, body: m === "POST" ? JSON.stringify(b || {}) : undefined })); return { http: r.status, ...(await r.json()) }; };
const g = await call("POST", "/admin/create", { condition: "group", trial: true }, "pw");
const M = {};
for (const n of ["Agent 1", "Agent 2", "Agent 3", "Agent 4"]) { const r = await call("POST", "/join", { code: g.code, name: n }); M[n] = { code: g.code, memberId: r.memberId, token: r.token }; }
await call("POST", "/start", M["Agent 1"]); clock += 61_000;
const takeover = await call("POST", "/join", { code: g.code, name: "Agent 2" });
assert.equal(takeover.http, 409, "joining under a signed-in teammate's name must be refused");
assert.equal(takeover.token, undefined, "no sign-in token may be handed out");
const victim = await call("GET", `/state?code=${g.code}&memberId=${M["Agent 2"].memberId}&token=${M["Agent 2"].token}`);
assert.ok(!victim.error, "the real member stays signed in");
const d = await call("POST", "/admin/data", {}, "pw");
assert.equal(d.subs.length, 0, "nothing was submitted under anyone else's name");
console.log("IMPERSONATION TEST PASSED");
