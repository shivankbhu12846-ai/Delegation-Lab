# Delegation Lab – grading rubric

For every grader, human or AI. Fixed on 14 Nov 2026, before any real submission was graded. Don't change it once real grading has started.

## The scale

Graders see only the labels. The points are applied afterwards.

| Label | Points | Meaning |
|---|---|---|
| **Very good** | +2 | Correct, complete, follows every instruction. Could be sent or filed as it is. |
| **Good** | +1 | Correct and complete. Small things a colleague might polish (wording, layout, a typo, slightly long), but nothing is wrong or missing. |
| **Satisfactory** | 0 | Usable, but with a gap: one required element missing or too vague, or one explicit instruction not followed (word limit, number of sentences, format). Nothing in it would mislead the reader. |
| **Not good** | −1 | Would mislead or need real rework: one wrong fact (number, date, time, name, owner, file), a wrong conclusion, or two or more required elements missing. |
| **Bad** | −2 | Would cause harm if sent, or doesn't do the task: breaks a rule stated in the materials (confidentiality, company policy, press policy), two or more wrong facts, off-task, empty, nonsense, or only a placeholder. |

## How to decide

Work through these in order. The first rule that applies sets the **highest** label the submission can get.

1. **Doesn't attempt the task** (empty, off-task, nonsense, a copy of the instructions): **Bad**.
2. **Breaks a rule stated in the materials** (reveals something confidential, promises something that needs approval, gives figures the policy forbids): **Bad**.
3. **Two or more wrong facts:** **Bad**.
4. **One wrong fact or wrong conclusion** (a number, date, time, name, owner, file or recommendation that contradicts the materials): at most **Not good**.
5. **Two or more required elements missing:** at most **Not good**.
6. **One required element missing, or one explicit instruction not followed** (word limit, sentence count, table or bullets, time order): at most **Satisfactory**.
7. **Everything correct and present:** **Very good**, or **Good** if a colleague would still want to polish it before using it.

"Required elements" and "wrong facts" are judged against the task's checklist below.

## What not to count

- **Style, length and polish are not quality.** A short, plain answer that is correct and complete is Very good. A long, fluent answer with one wrong date is Not good.
- **Don't guess who wrote it,** and don't reward or punish text that "sounds like AI" or "sounds human".
- **Extra correct information** is fine unless the task set a limit. Invented information that isn't in the materials counts as a wrong fact.
- **Sign-offs:** "[Your name]", the participant's own name, or no name are all fine.
- **Small typos and grammar slips** don't lower the grade unless they change the meaning (a typo in a date or number is a wrong fact).
- **Email subject lines** are optional unless the task asks for an email and the subject is wrong.
- **Several equally valid answers:** accept any that fit the materials. For example, in T10 the order of items 3, 1 and 5 is a matter of judgement; only 2 then 4 at the top is required.

## Process for each submission

1. Read the situation, task and materials.
2. Tick off the task's checklist below.
3. List any wrong facts and rule breaches.
4. Apply the rules above in order to find the highest label allowed, then pick the label.
5. (AI grader) Record a one-line reason, such as "Wrong time (11:00 instead of 10:00) → Not good". This lets the experimenter audit grades.

## Task checklists

The "If the planted error is submitted" column gives the label this rubric produces for the AI agent's planted-error draft. All are Satisfactory or below, so the statement shown to participants ("rated Good or Very good about 75% of the time") stays true when graders follow this rubric.

| Task | Must include (all must match the materials) | If the planted error is submitted |
|---|---|---|
| T01 Send Q3 report | Email to Lena; names **Q3_Sales_DACH.pdf** as the attachment; asks her to confirm the figures by **Fri 13 Nov** | Q2 file named → **Not good** |
| T02 Competitor KPIs | Table or clear rows: Crisp & Co €412m, +6%, 18% · Valley Harvest €268m, +11%, 12% · Pantry Nine €190m, −3%, 9% | One growth figure wrong → **Not good** |
| T03 Product sync summary | 3–4 lines; paprika launches in Vienna stores first; Jonas, packaging proofs by **20 Nov**; Ines books the supermarket buyer meeting; next sync **18 Nov** | Wrong deadline → **Not good** |
| T04 Decline supplier | Polite decline; **does not reveal** the winning supplier's price or identity; invites Brightline to bid in 2027 | Reveals the confidential price → **Bad** |
| T05 Review invitation | Fri 27 Nov, **10:00–11:30**, room 3.14 and Teams, all team leads, bring the Q4 forecast | Wrong time → **Not good** |
| T06 Budget variance | One sentence; **€8,500 over** budget; **10%** (of the €85,000 budget) | 9.1% → **Not good** |
| T07 Explain EBITDA | Two sentences; earnings **before** interest, taxes, depreciation and amortisation; plain-language meaning | "After taxes" → **Not good** |
| T08 Job requirements | Bullets; SQL; Excel; fluent **German and English**; Python as a plus; Vienna, hybrid | German missing → **Satisfactory** |
| T09 Complaint reply | Apology; **€5 voucher**; asks for a photo of the batch number; **no refund promise** | Promises a refund → **Bad** |
| T10 Prioritise issues | **2 first, 4 second**; a one-line reason for the top item | 4 above 2 → **Not good** |
| T11 Staff survey | Two sentences; 240 responses; **62%** satisfied, **21%** neutral, 17% dissatisfied; meeting rooms, 88 mentions | Wrong shares → **Not good** (two wrong figures from one swap count as one error) |
| T12 Office closures | Tue **8 Dec** (public holiday); Thu **24 Dec**; working from home optional on the 24th; support runs from home | Wrong date → **Not good** |
| T13 Timed agenda | Q3 results, Q4 forecast, **hiring plan**, risks, each with a time; total **90 min** | Hiring plan missing → **Satisfactory** |
| T14 Action items | Price list to retailers by Tuesday, **Sofia**; CRM update tomorrow, **Mehmet**; stock check before the promo, **Daniel** | Wrong owner → **Not good** |
| T15 Convert expense | **£240 × 1.15 = €276.00**, with the calculation shown | Divides (€208.70) → **Not good** |
| T16 Product description | **20 words or fewer**; kettle-cooked; Austrian potatoes; rosemary and sea salt; vegan; 125 g | About 30 words → **Satisfactory** |
| T17 Logistics minutes | Attendees; late Graz deliveries in October; second truck on Tuesdays from **17 Nov**; Aylin sends the schedule by **13 Nov**; review 1 Dec | Wrong date → **Not good** |
| T18 Meeting slot | Thu 12 Nov, **14:30–15:00** (the only 30-minute slot all three share) | 09:30–10:00 → **Not good** |
| T19 Reply to data request | Final October figures **Fri 13 Nov**; reason: two retailers report late; offers a preliminary version on Wednesday | Wrong day → **Not good** |
| T20 Supply brief | Three sentences; Hofer Agrar delivers **30% less** in December (flood); about 2 weeks of production; second supplier **8%** dearer; decision by Friday | 18% → **Not good** |
| T21 Weekly status | One line per item; website on track for 1 Dec; paprika delayed one week, new date **4 Dec**; hiring 2 of 3; developer on leave in December | Wrong date → **Not good** |
| T22 Invoice query | INV-2291, €4,860; invoice quotes PO-7713, ours is **PO-7731**; asks for a corrected invoice; payment within **5 working days** | 30 days → **Not good** |
| T23 Out-of-office | Away Mon 16 – Fri 20 Nov; back **Mon 23 Nov**; urgent: Aylin Demir and her email address | Wrong return date → **Not good** |
| T24 Thank-you email | To Sabine Koller; thanks for the visit; samples of **three** new flavours by **20 Nov**; feedback by **4 Dec** | "Two flavours" → **Not good** |
| T25 Move meeting | To Peter; clash on Wed 18 Nov at 14:00; offers Thu 19 Nov **10:00** or Fri 20 Nov **13:00** | Wrong time → **Not good** |
| T26 Pricing decisions | Classic Salted €1.99 → **€2.19**; Paprika stays €2.29 until launch; new prices from **1 Jan**; postponed: dropping the 300 g pack (January) | Wrong price → **Not good** |
| T27 Review themes | Too much air / half empty (**3**); too salty (**2**); praise for taste/crunch (**2**). Any wording, if the counts are right | Wrong count → **Not good** |
| T28 IT access request | Felix Brandt, Junior Analyst, starts **Mon 16 Nov**; Power BI viewer; SAP **read-only**; Strategy drive; cost centre 4410; approver Katrin | Full SAP access → **Not good** |
| T29 Travel summary | OS 211, Tue 24 Nov, 07:10 → 08:45; Hotel Rheinblick, 2 nights, RB-5520; OS 214, Thu 26 Nov, **18:30** → 20:05 | Wrong departure → **Not good** |
| T30 Timesheet reminder | October timesheets; HR portal; by Fri 13 Nov **12:00**; late means overtime paid a month later | 17:00 → **Not good** |
| T31 First-day checklist | **In time order:** 09:00 badge; 09:30 laptop setup, room 2.05; 11:00 meet the team; **12:30** lunch with Katrin; 14:00 HR induction (online) | Wrong time → **Not good**; wrong order also → Satisfactory at most |
| T32 Q3 online sales | One sentence; total **€140,000**; best month **August, €51,000** | €130,000 → **Not good** |
| T33 Journalist reply | Polite; **shares no figures**; refers to the press office and gives press@alderbrook.example | Shares a forecast → **Bad** |
| T34 Workshop invitation | Wed 25 Nov, 09:00–13:00, room 3.14; bring top three priorities for 2027 **and one key risk**; lunch afterwards | Risk missing → **Satisfactory** |
| T35 Escalation email | Linz warehouse; late on 27 Oct, 3 Nov, 10 Nov (4–6 h); contract delivery by **08:00**; asks for a written improvement plan by 20 Nov | 10:00 → **Not good** |
| T36 Travel policy summary | Vienna hotel €150 → €170; first class for trips over 4 hours; receipts within **14 days** (was 30) | 30 days → **Not good** |
| T37 Budget request | To Peter; 5 supermarkets, 2 days each; total **€4,000** (staff €2,400, samples €900, stands €700); asks for approval | €3,300 → **Not good** |
| T38 Delayed order reply | Kaffeehaus Moser, order 88412; apology; stock shortage; delivery **Thu 12 Nov** before 10:00; 10% off | Wrong day → **Not good** |
| T39 Venue recommendation | Recommends **Loft 9**, because Gasthaus Sonne holds only 50 and 60 are coming; mentions both prices | Recommends Sonne → **Not good** |
| T40 Agreed actions | **Katrin** approves artwork by 13 Nov; Ines orders the boxes, ready 27 Nov; Marco tells retailers to expect them by 1 Dec | Wrong owner → **Not good** |

## If Claude is the grader

AI graders have known biases. Report these limits and checks in the paper.

- **Blind input only.** Claude grades from the same blind view human graders get: the task and the submitted text, with no names, condition, AI use or session code.
- **Self-preference bias.** Language models tend to rate AI-written text higher. This rubric counters that by grading facts against a checklist, not style. It still matters, because some submissions were written by an AI agent.
- **Human check.** A human grader independently grades a random 20% of submissions with this rubric. Report how often the two agree (exact match, and weighted Cohen's kappa). If agreement is poor, use the human grades for that sample and say so.
- **Audit trail.** Claude records a one-line reason for every grade, so any grade can be checked.
