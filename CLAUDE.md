# Delegation Lab

Experiment platform for Shivank Verma's research paper (Agentic AI in Strategy and Innovation). It tests whether people delegate more work to an AI agent in a group with equally shared rewards than alone. Main measure: each person's share of tasks done with the AI agent. **Every task must be credited to the person who actually did it.**

## Layout
- `public/index.html`: the whole website (participant `/`, grader `#grade`, experimenter `#admin`)
- `netlify/lib/core.mjs`: server logic. `netlify/lib/tasks.mjs`: the 40 tasks (server only). `netlify/functions/api.mjs`: Netlify entry point
- Deployed from GitHub to Netlify. Data lives in Netlify Blobs. Secrets are Netlify environment variables.

## Commands
- `npm test`: all tests (no install needed, Node 20+). Run before and after every change.
- `npm run dev`: local preview at http://localhost:8787 with a fake AI model (passwords `pw` / `gpw`)
- `npm run demo`: builds `demo.html`, a one-file demo that runs without a server

## Rules
1. Never loosen sign-in. A name already in a session needs that browser's token or the experimenter's one-time rejoin code. Any change to join, leave, tokens or reset must keep `tests/impersonation.test.mjs` passing, and needs a new test that tries to impersonate someone.
2. Graders must never see the condition, names, AI use or numeric scores. Participants must never receive `answer`, `weak` or `flaw` from `tasks.mjs`.
3. Never delete or rewrite experiment data on the live site. Deleting is the experimenter's job, through the dashboard.
4. Don't change the design (40 tasks; 10 per individual, 40 per group; 60 s reading + 600 s work; −2..+2 grades; payout max(points × ₹6.25, 0) = up to ₹125 per person, groups split their pool equally; participants start sessions themselves) without asking.
5. Commit before big changes. Log every bug fix in `BUILD_LOG.md` with before, after and how it was tested.
6. Show proof: test output, a screenshot, or a link. "It should work" is not proof.
