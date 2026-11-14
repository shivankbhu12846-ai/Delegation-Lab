// Local stand-in for Netlify: serves public/ and routes /api/* to the real handler with an in-memory store.
import http from "node:http";
import fs from "node:fs";
import { createHandler, memoryStore } from "../netlify/lib/core.mjs";

const ROOT = new URL("../public", import.meta.url).pathname;
const store = memoryStore();
const handle = createHandler({
  store,
  env: { EXPERIMENTER_PASSWORD: "pw", GRADER_PASSWORD: "gpw", AI_API_KEY: "test" },
  fetchImpl: async (url, opts) => {
    const weak = JSON.parse(opts.body).messages.at(-1).content.includes("Include exactly one error");
    await new Promise((r) => setTimeout(r, 400));
    return new Response(JSON.stringify({ content: [{ type: "text", text: weak
      ? "Subject: Update\n\nHi team,\n\nThe meeting is on Friday at 11:00 in room 3.14. Please bring your forecast.\n\nThanks,\n[Your name]"
      : "Subject: Update\n\nHi team,\n\nThe meeting is on Friday at 10:00 in room 3.14. Please bring your Q4 forecast.\n\nThanks,\n[Your name]" }] }), { status: 200 });
  },
});

http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handle(new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, { "content-type": "application/json" }); res.end(await r.text()); return;
  }
  const file = ROOT + (req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]);
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(fs.readFileSync(file));
}).listen(8787, () => console.log("Local preview: http://localhost:8787  (experimenter password: pw, grader password: gpw, fake AI)"));
