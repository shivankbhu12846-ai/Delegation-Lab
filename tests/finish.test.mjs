import { createHandler, memoryStore } from "../netlify/lib/core.mjs";
import assert from "node:assert/strict";
let clock = 1_900_000_000_000;
const h = createHandler({ store: memoryStore(), env: { EXPERIMENTER_PASSWORD: "pw", GRADER_PASSWORD: "g" }, now: () => clock });
const call = async (m, p, b, k) => { const r = await h(new Request("https://x/api" + p, { method: m, headers: k ? { "x-key": k } : {}, body: m === "POST" ? JSON.stringify(b || {}) : undefined })); return { status: r.status, ...(await r.json()) }; };
// individual submits all 10 -> finished with time left, session gradeable before the clock ends
const s = await call("POST", "/admin/create", { condition: "individual" }, "pw");
const j = await call("POST", "/join", { code: s.code, name: "Ana" }); const c = { code: s.code, memberId: j.memberId, token: j.token };
await call("POST", "/start", c); clock += 61_000;
for (const id of s.taskIds) assert.equal((await call("POST", "/submit", { ...c, taskId: id, text: "answer " + id })).status, 200);
clock += 30_000;
let st = await call("GET", `/state?code=${s.code}&memberId=${c.memberId}&token=${c.token}`);
assert.equal(st.allSubmitted, true); assert.equal(st.me.finished, true); assert.ok(st.me.finish.secLeft > 500, JSON.stringify(st.me.finish));
let g = await call("POST", "/grade/next", { judge: "G" }, "g"); assert.equal(g.progress.total, 10, "gradeable right after finishing");
// group: one member presses Finish, can't submit; others continue; when all finish, session closes
const gs = await call("POST", "/admin/create", { condition: "group" }, "pw"); const m = [];
for (const n of ["A", "B", "C", "D"]) { const r = await call("POST", "/join", { code: gs.code, name: n }); m.push({ code: gs.code, memberId: r.memberId, token: r.token }); }
assert.equal((await call("POST", "/finish", m[0])).status, 409, "can't finish in lobby");
await call("POST", "/start", m[0]); clock += 61_000;
await call("POST", "/submit", { ...m[0], taskId: gs.taskIds[0], text: "x" });
assert.equal((await call("POST", "/finish", m[0])).status, 200);
assert.equal((await call("POST", "/submit", { ...m[0], taskId: gs.taskIds[1], text: "y" })).status, 409, "finished member blocked");
assert.equal((await call("POST", "/agent", { ...m[0], taskId: gs.taskIds[1] })).status, 409);
assert.equal((await call("POST", "/submit", { ...m[1], taskId: gs.taskIds[1], text: "y" })).status, 200, "teammate continues");
g = await call("POST", "/grade/next", { judge: "G2" }, "g"); assert.equal(g.progress.total, 10, "group not gradeable yet");
for (const x of m.slice(1)) await call("POST", "/finish", x);
g = await call("POST", "/grade/next", { judge: "G2" }, "g"); assert.equal(g.progress.total, 12, "group gradeable after all finished");
const d = await call("POST", "/admin/data", {}, "pw"); assert.equal(d.finishes.length, 5);
await call("POST", "/admin/delete", { codes: [gs.code] }, "pw");
const d2 = await call("POST", "/admin/data", {}, "pw"); assert.equal(d2.finishes.length, 1, "finish records deleted with session");
console.log("FINISH TESTS PASSED");
