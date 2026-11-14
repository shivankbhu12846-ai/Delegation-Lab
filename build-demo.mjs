// Builds the single-file demo page (no server needed): the real page + the server logic running in the browser.
import fs from "node:fs";
const page = fs.readFileSync("public/index.html", "utf8");
const strip = (src) => src.replace(/^import .*$/gm, "").replace(/^export (?=function|const|class|async)/gm, "");
const tasks = strip(fs.readFileSync("netlify/lib/tasks.mjs", "utf8"));
const core = strip(fs.readFileSync("netlify/lib/core.mjs", "utf8"));
const demo = `<script>
(function(){
${tasks}
${core}
let saved = {}; try { saved = JSON.parse(localStorage.getItem("dl-demo-store") || "{}"); } catch (e) {}
const store = memoryStore(saved, (m) => { try { localStorage.setItem("dl-demo-store", JSON.stringify(Object.fromEntries(m))); } catch (e) {} });
window.DEMO_HANDLER = createHandler({ store, demo: true });
})();
</script>`;
// Keep the whole page (doctype, head, body) and add the in-browser server just before the app script.
const i = page.lastIndexOf("<script>");
fs.writeFileSync(process.argv[2], page.slice(0, i) + demo + "\n" + page.slice(i));
console.log("demo written", process.argv[2]);
