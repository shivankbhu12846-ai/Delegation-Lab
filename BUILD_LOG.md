# Delegation Lab – build log

## 13 Nov 2026 · Security fix: anyone could take over a group member by typing their name

**Severity:** high. It let one participant act as another, which corrupts the study's main measure (each person's share of tasks delegated to the AI agent).
**Found by:** project review (a separate Claude chat in this project), reported by Shivank Verma. Reproduced live on trial session `8WL3F9` by joining as "Agent 2 (trial)" while Agent 2 was still signed in on another tab.
**Status:** fixed and retested.

### Before

Earlier the same day I fixed a different bug: a member who left a group's waiting room couldn't come back, and their seat stayed blocked. My fix let anyone rejoin a session **by typing a name that was already in it**. The server issued a new sign-in to whoever typed the name and signed out the real person. It never checked that the person typing was the person who owned that seat.

Result: any group member could become any teammate, see their screen, and submit tasks under their name.

Exploit run against that build (Agent 1 types "Agent 2 (trial)" mid-session, with no sign-in token, then submits a task):

```json
{
 "build": "BEFORE (13 Nov build)",
 "takeoverStatus": 200,
 "takeoverMessage": "joined as Agent 2",
 "taskRecordedAs": "agent-2-trial",
 "realAgent2StillSignedIn": false
}
```

Agent 1's work was credited to Agent 2, and the real Agent 2 was thrown out.

### After

The original rule is back: **a name that's already in a session can only be used by the browser that holds its sign-in**. Leaving and resets are handled explicitly:

| Situation | Behaviour now |
|---|---|
| Typing a name that's already in the session | Refused, before or after the start, in any capitalisation |
| *Leave and free this seat* in the waiting room (before the start) | Server deletes the member record and the seat, so anyone can join |
| Experimenter clicks *remove* (before the start) | Same: seat freed |
| Closed the tab, same browser | Signed straight back in, using the token stored in that browser |
| Lost the browser or device mid-session | Experimenter clicks *reset sign-in*. The old sign-in stops working everywhere, and a one-time 6-character rejoin code is shown. The participant joins with the same name plus that code. The code works once and only for that member. |
| New person after the start | Refused |

Same exploit, fixed build:

```json
{
 "build": "AFTER (fix)",
 "takeoverStatus": 409,
 "takeoverMessage": "Someone with that name is already in this session. If that's you on a different device or browser, ask the experimenter to reset your sign-in and give you a rejoin code.",
 "taskRecordedAs": "-",
 "realAgent2StillSignedIn": true
}
```

### What changed

- `netlify/lib/core.mjs`
  - `/join`: a taken name needs the stored token or the experimenter's one-time rejoin code. The name alone is refused.
  - `/leave` (before the start only) frees the member record and seat.
  - New `/admin/reset`: signs the member out everywhere and returns a one-time rejoin code.
  - The dashboard data shows a pending rejoin code. Tokens are never sent to it.
- `public/index.html`
  - The join form has an optional rejoin-code field.
  - The join form keeps what was typed after an error. A second bug found during retesting: a failed join used to clear the name field, so a retry silently didn't submit.
  - The sessions table has *reset sign-in* for each member, and *remove* before the start, and shows pending codes.
  - Sign-in is stored per browser tab. *Use this tab for another person* lets several members be tested on one computer without sharing a sign-in.

### Retest

Automated checks against the server: 34 assertions, all passing. They cover leave → seat freed → same person or someone else joins; takeover refused in the waiting room, mid-session, with other capitalisation, and with a made-up code; the real member stays signed in; reset → old sign-in invalid → name alone still refused → code works once, only for that member; work restored after rejoin; every task credited to the right person; individual sessions. The earlier server, early-finish and grading tests also still pass.

Browser run, one browser per member, four-person trial group:

```
1a. Agent 3 leaves: seat freed in Agent 1's view     yes
1b. Agent 3 rejoins the free seat                    joined
2a. Join as signed-in Agent 2 by name                Someone with that name is already in this session. If that's you on a different device or browser, ask the experimenter to reset your sign-in and give you a rejoin code.
2b. ...with a made-up rejoin code                    That rejoin code isn't right for this name. Check both with the experimenter.
2c. Real Agent 2 still signed in                     yes
    New tab in the same browser opens as             Tab A (you)
    After 'use this tab for another person'          Tab A (you) / Tab B (you)
3a. All four members submitted one task each         yes
3b. Takeover attempt mid-session                     Someone with that name is already in this session. …
3c. Experimenter reset of Agent 4                    Rejoin code for Agent 4 (trial): BXV7Y9 …
3d. Agent 4's old browser                            You've been signed out of this session. To get back in, ask the experimenter for a rejoin code.
3e. Agent 4 on a new browser with the code           back in, earlier submission shown
3f. Same rejoin code used a second time              That rejoin code isn't right for this name. …
3g. Dashboard credits each task to the member who did it (Agent 1–4), page errors: none
```

### Notes

- Sessions run on the vulnerable build (13 Nov, before this fix was deployed) can't be fully trusted for per-person data. Any member marked *rejoined* in those sessions may have been taken over. They were trial sessions; delete them.
- The rejoin code is read out by the experimenter. Anyone who overhears it could use it first, but only once, only for that one member, and the real member would then be refused and come straight back to the experimenter. That's acceptable for a supervised classroom session.
- Lesson: the first fix solved the reported symptom (seat stuck) by loosening sign-in, instead of fixing the cause (Leave didn't free the seat on the server). Changes to who-is-who need a test that tries to impersonate someone, not only a test that the honest path works.
