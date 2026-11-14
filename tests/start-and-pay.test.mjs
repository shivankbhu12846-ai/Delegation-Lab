// Participants start sessions themselves (no experimenter step); payout is up to ₹125 per person.
import { createHandler, memoryStore, rateFor } from "../netlify/lib/core.mjs";
import assert from "node:assert/strict";
let clock = 2_200_000_000_000;
const h = createHandler({ store: memoryStore(), env: { EXPERIMENTER_PASSWORD: "pw" }, now: () => clock });
const call = async (m, p, b, k) => { const r = await h(new Request("https://x/api" + p, { method: m, headers: k ? { "x-key": k } : {}, body: m === "POST" ? JSON.stringify(b || {}) : undefined })); return { http: r.status, ...(await r.json()) }; };
const st = (c) => call("GET", `/state?code=${c.code}&memberId=${c.memberId}&token=${c.token}`);

// payout rate: ₹125 max per person -> ₹6.25 per point; perfect individual = ₹125, perfect group pool = ₹500 = ₹125 each
assert.equal(rateFor({ maxPayout: 125 }), 6.25);
assert.equal(rateFor({}), 6.25, "default is ₹125");
assert.equal(10 * 2 * rateFor({}), 125);
assert.equal((40 * 2 * rateFor({})) / 4, 125);

// individual starts on their own
const i = await call("POST", "/admin/create", { condition: "individual" }, "pw");
const a = await call("POST", "/join", { code: i.code, name: "Asha" }); const ca = { code: i.code, memberId: a.memberId, token: a.token };
const s0 = await st(ca);
assert.equal(s0.maxPayout, 125); assert.equal(s0.rsPerPoint, 6.25, "participants are told ₹6.25 per point");
assert.equal((await call("POST", "/start", ca)).http, 200);
assert.equal((await st(ca)).phase, "preview", "clock running without the experimenter");

// group: start with everyone, or (after confirming) without waiting for all four
const g = await call("POST", "/admin/create", { condition: "group" }, "pw");
const m = []; for (const n of ["A", "B", "C"]) { const r = await call("POST", "/join", { code: g.code, name: n }); m.push({ code: g.code, memberId: r.memberId, token: r.token }); }
const noForce = await call("POST", "/start", m[0]);
assert.equal(noForce.http, 409); assert.match(noForce.error, /Only 3 of 4/);
assert.equal((await st(m[0])).phase, "lobby", "not started without confirmation");
assert.equal((await call("POST", "/start", { ...m[1], force: true })).http, 200, "any member can start after confirming");
assert.equal((await st(m[2])).phase, "preview", "started for everyone");
assert.equal((await call("POST", "/join", { code: g.code, name: "D" })).http, 409, "nobody joins after the start");
// a full group starts without any confirmation
const g2 = await call("POST", "/admin/create", { condition: "group" }, "pw");
const m2 = []; for (const n of ["A", "B", "C", "D"]) { const r = await call("POST", "/join", { code: g2.code, name: n }); m2.push({ code: g2.code, memberId: r.memberId, token: r.token }); }
assert.equal((await call("POST", "/start", m2[3])).http, 200);
// settings change applies to new sessions only
await call("POST", "/admin/settings", { settings: { plantedErrors: true, agentMode: "live", previewSec: 60, workSec: 600, maxPayout: 250 } }, "pw");
const i2 = await call("POST", "/admin/create", { condition: "individual" }, "pw");
const b = await call("POST", "/join", { code: i2.code, name: "Ben" });
assert.equal((await st({ code: i2.code, memberId: b.memberId, token: b.token })).rsPerPoint, 12.5);
assert.equal((await st(ca)).rsPerPoint, 6.25, "existing session keeps its rate");
console.log("START AND PAY TESTS PASSED");
