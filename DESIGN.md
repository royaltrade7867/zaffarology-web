# Zaffarology web — design system

The visual world is **inherited, not invented**. The phone app established it and
the two share one account; this document records it and extends it for a wide
screen. Nothing here is a new identity.

## The world in one line

A paper workbook: the user's own handwriting on white paper, laid on a coloured
page. Everything that is not the user's words is the printing around them.

## The rule everything else follows

**Text colour follows the SURFACE, not the theme.**

Writing surfaces — anything the user types into — stay white (or the pale green
"still to fill" wash) in *both* themes, because they are paper. The page and the
cards change with the theme.

| Text sits on | Use | Light | Dark |
|---|---|---|---|
| a field (`--field`, `--field-empty`) | `--on-card` | 17.4:1 | 17.4:1 |
| a card (`--surface`) | `--ink` / `--heading` | 17.4:1 | 11.2:1 |
| the page (`--background`) | `--ink` / `--heading` | 17.4:1 | 13.1:1 |

Getting this backwards yields **~1.2:1 — invisible text**. `ink` on a white
field and `on-card` on a dark card have both shipped as bugs on the phone. When
in doubt, ask what the text is sitting on, never what the theme is.

## Colour

Two themes, the same tokens. Dark is the phone's default and matches it exactly.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `#F7F6F2` paper | `#0D2440` navy | the page |
| `--surface` | `#FFFFFF` | `#14304F` | cards |
| `--surface-deep` | `#EFEEE9` | `#081A30` | pressed / inset |
| `--ink` | `#191A1E` | `#F1EADC` cream | body text |
| `--heading` | `#1B3A5C` navy | `#F1EADC` | headings |
| `--muted` | `#4E6A8C` | `#9DB2CC` | secondary text |
| `--line` | `#D3D9E2` | `rgba(216,227,245,0.18)` | hairlines |
| `--gold` | `#8F6200` | `#D9A441` | the one accent |
| `--danger` | `#C8102E` | `#FF6B7A` | destructive, overdue |
| `--field` | `#FFFFFF` | **`#FFFFFF`** | a writing surface |
| `--field-empty` | `#F3FAF6` | **`#BCE6CE`** | one still to fill |
| `--on-card` | `#191A1E` | **`#191A1E`** | ink on a field |

Light gold is `#8F6200`, not the prototype's `#9A6A00`, which sits at 4.38:1 on
paper — the only accent to miss 4.5:1. All three definitions (CSS, the TS accent
map, the report palette) must agree; a fixture asserts it.

**Strategy: restrained.** Neutrals plus one accent. People come here to work,
not to be impressed, and the pillar accents already carry identity. Colour is
never scattered decoratively — an accent marks a pillar, a state, or an action.

### Pillar accents

One per pillar, used for that pillar's headings, numbers and active states:
P1 gold `#8F6200`, P2 red `#C8102E`, P3 green `#1F6B4A`, P4 blue `#1E4E8C`,
P5 plum `#6B2D5C`. These are the light values; on the dark page they are
lightened at use (see `accentOn()`), because a 4.9:1 accent on paper drops to
1.6:1 on navy.

## Type

**Archivo Black** for headings, labels and numbers. **Inter** for body. Both
inherited from the phone; neither is up for reconsideration here.

- Headings are set in caps at small sizes (12–13px, tracked) and sentence case
  at large. Archivo Black is heavy enough that caps below 12px turn to texture.
- Body measure caps at ~68ch. The workbook's own copy is long-form.
- Numbers are tabular wherever they are compared down a column.
- Tracking floor is -0.02em; Archivo Black is already tight.

## Space

A 4px base. The rhythm that matters: **more space above a heading than below
it**, so a heading belongs to what follows. Tight within a group, generous
between groups.

Cards are `rounded-2xl` (16px) with a 1px hairline and no shadow at rest —
elevation is declared once, by the border. A shadow appears only on hover for
something clickable.

## Wide screens

The phone stacks; the browser should not pretend to be a phone.

- Content column caps at `max-w-3xl` for reading, wider for tables and the
  Pillar 5 tree.
- Two columns from `sm:` where a form has natural pairs (date + time).
- The daily-report grid and the team table scroll inside their own container —
  the page body never scrolls horizontally.

## States

Every interactive element owes: rest, hover, `focus-visible`, disabled, and
where relevant loading and error. Focus is a visible ring in the accent, never
`outline: none` with nothing in its place.

The **browser's own surfaces** are part of the design and are themed: text
selection, the caret, scrollbars, and focus rings. These ship with defaults that
belong to no design system, and theming them is the cheapest signal that a page
was built rather than assembled.

## Motion

One authored moment, not scattered effects: an accordion or a panel opening
eases out from an already-visible state. Everything else is a colour transition
under 150ms. All of it respects `prefers-reduced-motion`.

## What must not change

- The workbook's copy.
- The stored shape of any pillar blob, note, meeting, assignment or recording.
- The green empty-field wash and what it means.
- White writing surfaces in both themes.
