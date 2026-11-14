# Delegation Lab

A timed online experiment that tests whether people rely more on an AI agent when they work in a group with equally shared rewards than when they work alone.

- **Individual:** 10 random tasks from a repository of 40. Paid max(points × ₹6.25, 0): up to ₹125.
- **Group of four:** all 40 tasks, with each member on their own computer. The group's max(points × ₹6.25, 0) is split equally among the members: up to ₹125 each.
- **Timing:** 1 minute to read the tasks, then 10 minutes to work.
- **AI agent:** one click per task. Participants can edit the agent's draft before submitting. Every AI request, every edit and its extent, and every submission are recorded.
- **Grading:** independent graders rate each submission as Bad, Not good, Satisfactory, Good or Very good. They never see numbers, the condition, or whether AI was used. These ratings count as −2 to +2.

## Files

| File | What it is |
|---|---|
| `public/index.html` | The website: participant, grader (`#grade`) and experimenter (`#admin`) views |
| `netlify/functions/api.mjs` | The server endpoint (`/api/*`) |
| `netlify/lib/core.mjs` | Server logic: sessions, timing, AI agent, edit tracking, grading, deletes |
| `netlify/lib/tasks.mjs` | The 40 tasks, with prepared answers and planted errors. This file stays on the server. |
| `package.json`, `netlify.toml` | Netlify setup |
| `build-demo.mjs` | Builds a one-file demo that runs without a server (optional) |
| `tests/` | Automated tests: run `npm test` (Node 20+, no install needed) |
| `scripts/dev-server.mjs` | Local preview with a fake AI model: `npm run dev` |
| `CLAUDE.md`, `.claude/settings.json` | Instructions and safety rules for Claude Code sessions on this repo |
| `BUILD_LOG.md` | Bugs found and fixed, with before/after evidence |

## Put it online

1. **Upload to GitHub.** Create a new repository and click *uploading an existing file*. Drag in everything *inside* this folder: `public`, `netlify`, `package.json`, `netlify.toml`, `README.md` and `build-demo.mjs`. Then click *Commit changes*.
2. **Connect Netlify.** Choose *Add new site → Import an existing project → GitHub* and pick the repository. Leave the build command empty; Netlify reads `netlify.toml`. Click *Deploy*.
3. **Add environment variables** under *Site configuration → Environment variables*:

   | Name | Value |
   |---|---|
   | `EXPERIMENTER_PASSWORD` | A password for you (the experimenter view) |
   | `GRADER_PASSWORD` | A password you give your graders |
   | `AI_API_KEY` | Your API key |
   | `AI_PROVIDER` | `anthropic` (default), `gemini` or `openai` |
   | `AI_MODEL` | Optional. Defaults: `claude-haiku-5-5` (Anthropic), `gemini-3.5-flash` (Gemini). Required for OpenAI. |

4. **Redeploy.** Go to *Deploys → Trigger deploy*, so the variables take effect.

Data is stored in Netlify Blobs, which needs no setup.

## Running a session

1. Open `your-site.netlify.app/#admin` and sign in.
2. Under *Create a session*, choose **Individual** or **Group of four**. Tick *Trial run* for test sessions. You get a 6-character code and a link.
3. Participants open the link, or the site, and enter the code and their name. Group members join from their own computers.
4. **Starting.** Participants start the session themselves; you don't need to do anything. Each person first sees full instructions and ticks *I've read the instructions*. An individual then presses *Start*. In a group, any member can press *Start for the whole group*. If not everyone has joined yet, they're asked to click again to confirm, because nobody can join after the start. The group's pay is then split among the members who joined.
5. The 1-minute reading time begins. Participants can read every task but can't write or use the AI. Then the 10-minute working time runs. Only submitted tasks count.
6. **Finishing.** A participant who is done presses *I'm done* (it asks for a second click to confirm). They can't do more tasks after that and can sign out. When every task is submitted, or every group member has pressed *I'm done*, the session ends early. Teammates keep working until then. The time each person had left is recorded.
7. Graders open `your-site.netlify.app/#grade` and grade submissions from finished sessions.

## What the experimenter sees

- **Sessions:** live status and countdown, members, submitted tasks, AI use, grading progress, points and payout per person.
- **Results:** the mean share of each person's tasks done with AI, by condition, with a dot per person. Also: edit extent, unedited AI drafts, planted errors passed unedited, and mean grades.
- **People and payouts:** one row per participant.
- **Responses:** every submission and every AI draft that wasn't submitted. Click a row to see the AI draft next to exactly what the participant changed.
- **Export:** CSV files for responses and for people and payouts.
- **Delete:** one session, selected sessions, all trial sessions, or everything. Deleting is permanent. Settings are kept.

### Measures

| Measure | Meaning |
|---|---|
| AI share | Submitted tasks where this person used the AI agent ÷ tasks they submitted |
| Characters changed | The smallest number of single-character insertions, deletions or replacements that turn the AI draft into the submitted text (Levenshtein distance). 0 = submitted as is. Spacing-only changes don't count. |
| Edit % | Characters changed ÷ the length of the longer text (AI draft or submission) |
| Words added / removed | Word-level difference between the AI draft and the submitted text |
| Review time | Seconds between receiving the AI draft and submitting |
| Planted errors passed | AI drafts with a planted error that were submitted unedited |
| Team used AI | (Groups) Another member asked the AI agent for this task, but the submitter didn't |

## Settings

- **AI agent:** *Live model* calls your API key. If a call fails, the agent uses the prepared answer and logs why. *Prepared answers only* is useful for trial runs.
- **Planted errors:** in each block of four tasks, one AI output contains a specific error. This keeps the statement shown to participants true: "the AI agent's output is rated Good or Very good about 75% of the time". Turn this off to hide the statement and the errors.
- **Maximum payout per person:** ₹125 by default. The rate per point is set so a perfect individual (10 tasks rated Very good) earns exactly this amount: ₹125 ÷ 20 points = ₹6.25 per point. Participants see the rate and the maximum in their instructions.
- **Reading and working time:** the defaults are 60 and 600 seconds. Shorten them for quick trials.

Settings apply to sessions created after you save them.

## Good to know

- **Free API keys** have rate limits. Several groups working at once can hit them. When a call fails, the agent falls back to the prepared answer, and the *Source* column shows it.
- **Grading queue:** graders see submissions from every finished session, trial runs included. Delete trial sessions before your real graders start.
- **Leaving and rejoining:**
  - *Before the start:* *Leave and free this seat* in the waiting room removes a participant, so anyone can take the seat. You can also click *remove* next to a name in the sessions table.
  - *Returning on the same browser:* a participant who closes the page is signed straight back in when they reopen the site.
  - *A name that is already taken can't be claimed by typing it.* Coming back from a different device or browser needs a one-time rejoin code. Click *reset sign-in* next to the member in the sessions table. This signs them out everywhere and shows a 6-character code. They join with the session code, the same name, and the rejoin code. Their work is kept, and the code works once.
  - *After the start*, nobody new can join. The dashboard marks people who rejoined.
  - *Testing several members on one computer:* in a group's waiting room, click *Use this tab for another person*, then join under another name in that tab.
