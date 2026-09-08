# Zaffarology — product truth

## What it is

A digital version of Zaffar Khan's *Success Pillars* workbook. Five pillars, each
a page of the paper workbook made live: you read the instruction, fill in your
own words, and come back to it. The copy is the workbook's, not new writing —
the only licensed change is that "workbook" becomes "app".

It is a **workbook**, not a productivity tool. That distinction drives the
visual world: white writing surfaces on a coloured page, because the user's own
words are the content and everything else is the printed page around them.

## Who uses it, and when

**Equal partner to the phone.** A person can live entirely in the web app or
entirely on the phone; the two share one account and one set of data, and either
must be enough on its own. Nothing may read as "do this on your phone".

Three account kinds:

- **individual** — one person working the pillars for themselves
- **company_admin** — creates a company, gets an invite code, and can see their
  team's per-pillar progress
- **employee** — joins a company with that code

They connect person-to-person by email and tag each other on tasks, which puts a
task on the other person's board.

## What people actually do here

Daily, and the reason to open it at all:

- **Pillar 1** — one exact goal per project, its plan, its deadline, and today's
  do-or-die list
- **Pillar 3** — plan the money-making actions in the morning, mark achievement
  in the evening
- **Pillar 4** — a running huddle board; tick things off, extend what slips
- **Pillar 5, daily reports** — answer each business system's effort and result
  questions for the day
- **Notes and meeting notes** — including voice recordings

Occasionally:

- **Pillar 2** — a problem, and the possible solutions under it
- **Pillar 5, the tree** — businesses → departments → systems, defined once
- **Reports** — a PDF or plain text of one pillar or all of them
- **Team** — connections, and a company admin's view of progress

## Constraints that are not negotiable

- **The copy is the workbook's.** Do not rewrite a heading, a summary or a core
  truth to read better. Instructional copy this app added of its own (a
  placeholder, an empty state) is fair game.
- **Five pillars, numbered 1–5.** The folder and the App Store listing still say
  "8 Pillars"; the app does not. Pillar 5's storage key is
  `pillar-8-business-systems` for historical reasons and must not be "fixed".
- **The phone and the web write the same data.** Both apps read and write the
  same `/v3/pillars/{key}` blobs, the same notes, meetings, assignments,
  recordings and daily answers. A design change must never change a stored
  shape.
- **Writing surfaces stay white.** A field the user types into is paper, in
  every theme. Text on it is dark ink, never the page's foreground colour.
- **An empty fillable field is washed pale green**, and turns white once it has
  something in it. This is the app's way of saying "this one is still yours to
  fill", and it is what makes a long workbook page scannable.
- **Accessibility is a floor, not a goal.** Body text ≥ 4.5:1, UI text and
  borders ≥ 3:1, every control reachable and named. Several contrast bugs have
  already shipped here; measurement is not optional.

## What success looks like on this surface

Someone opens the app in the morning, sees what today asks of them, writes in
their own words, and closes it. The design's job is to make the page legible and
the next action obvious — not to be admired. Brand lives in the details:
the pillar accents, the paper, Archivo Black on the headings.
