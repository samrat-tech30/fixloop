---
name: fixloop-frontend-sky-ink
description: Sky Ink design system adapted for FixLoop's Next.js frontend. Use for any UI work in frontend/ — pages, components, Tailwind classes, the Explain screen, Fix (agent run) screen, Stats screen, result cards, step timelines, diff views, feedback buttons, loading, empty and error states.
---

# FixLoop · Sky Ink

Calm and editorial: white page, near-black ink, an elegant serif for headlines, **one** blue for the main action, a soft sky-blue block for the hero moment, yellow only as a highlighter. Engineers use this mid-incident, so clarity beats decoration.

## Non-negotiables
1. **Colours only from tokens** (already in `frontend/src/app/globals.css` as Tailwind theme colours). Never invent a hex. No purple, gradients, glassmorphism or neon.
2. **One blue action per view** (`bg-sx-blue`): "Diagnose" on Explain, "Run agent" on Fix. Everything else: black pill, outlined pill or text link.
3. **Sky block** (`bg-sx-sky`) for one large block per page — the input hero on Explain, the status banner on Fix.
4. **Yellow (`bg-sx-marker`) is a highlighter**: the key phrase in a summary, a "new" tag. Never a button or a big area.
5. **Type:** Newsreader 500 for headings and big numbers (`font-serif`), Geist for everything else (`font-sans`), Geist Mono for logs and diffs (`font-mono`).
6. **Pills for everything clickable** (`rounded-full`). Surfaces `rounded-2xl` (16px), inputs `rounded-xl` (12px).
7. **White page, 1px `border-sx-line` borders, no shadows** except the main log input (`shadow-sm`).
8. **Motion:** 200ms state changes, 800ms scene changes, loops 2.4–5s; wrap in `motion-safe:`.
9. **Accessible:** contrast ≥ 4.5:1, real `<button>`/`<label>`, visible focus ring (`focus-visible:ring-2 ring-sx-ring`), 44px targets, `aria-label` on icon buttons, `aria-live="polite"` on the result and step log.
10. **No emoji in UI** — use `lucide-react` icons at 1.8–2px stroke. (Feedback buttons are `ThumbsUp` / `ThumbsDown` icons, not emoji.)

## Tokens
| Tailwind class | Hex | Use |
|---|---|---|
| `sx-page` | #FFFFFF | page |
| `sx-ink` | #0A0A0A | text, dark pills |
| `sx-mute` | #52525B | secondary text |
| `sx-subtle` | #71717A | placeholders, captions |
| `sx-line` | #E4E4E7 | borders, dividers |
| `sx-field-line` | #D4D4D8 | input borders |
| `sx-soft` | #F4F4F5 | quiet fills, code blocks |
| `sx-panel` | #EEF6FF | side panels |
| `sx-sky` | #CFE6FF | hero block |
| `sx-blue` / `sx-blue-hover` | #2563EB / #1D4ED8 | the one primary action |
| `sx-ring` | #93C5FD | focus ring |
| `sx-marker` | #FFE45C | highlighter |

**Status colours** (FixLoop addition, text on white passes 4.5:1): `sx-critical` #B91C1C, `sx-warning` #A16207, `sx-good` #15803D. Use them only for severity/status text and 1px borders with a `sx-soft` fill — never large coloured areas.

## Components (reuse these, don't invent new ones)
- **Primary button:** `rounded-full bg-sx-blue px-6 h-11 text-white font-medium hover:bg-sx-blue-hover disabled:opacity-50`.
- **Dark pill:** `rounded-full bg-sx-ink text-white px-5 h-11`. **Outlined pill:** `rounded-full border border-sx-line px-5 h-11 text-sx-ink`.
- **Chip/tag:** `rounded-full border border-sx-line px-3 py-1 text-sm text-sx-mute`.
- **Severity pill:** chip with `text-sx-critical border-sx-critical` (critical), warning, or `text-sx-mute` (info).
- **Card:** `rounded-2xl border border-sx-line p-6 bg-sx-page`.
- **Log textarea:** `rounded-xl border border-sx-field-line font-mono text-sm min-h-64 p-4 shadow-sm`.
- **Code/evidence:** `<pre className="rounded-xl bg-sx-soft p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">`.
- **Confidence bar:** 6px tall `rounded-full bg-sx-soft` track, `bg-sx-ink` fill, label "92% confident".
- **Fix steps:** `<ol>` numbered, each step with an icon button "Copy" (`aria-label="Copy step 2"`).
- **Step timeline (Fix):** vertical list, each row = icon (Loader2 spinning / CheckCircle2 good / XCircle critical / Hand for hand-off) + action label + summary + expandable `<pre>` excerpt.
- **Diff view:** `<pre>` with lines starting `+` in `text-sx-good`, `-` in `text-sx-critical`; never colour backgrounds.
- **Big number (Stats):** Newsreader 500, `text-5xl tracking-tight`, caption in Geist `text-sm text-sx-mute`.
- **Offline badge:** chip with `WifiOff` icon "Running offline (local model)".
- **Redaction note:** small text with `ShieldCheck` icon "2 secrets masked before analysis".

## Screens
- **Explain (`/`)**: sky hero block with the headline "Paste a failed deploy log. Get the fix." and the textarea + "Try a sample" select + Diagnose. Result card below. Max width 960px, 16px side gutters on mobile.
- **Fix (`/fix`)**: scenario select + auto-approve switch + Run agent. Status banner (sky) on top, timeline left, patch/diff panel right (stacks on mobile).
- **Stats (`/stats`)**: 4 big numbers in a 2×2 grid (1 column on mobile), totals row below.

## Copy voice
Short, calm, plain English, sentence case, for DevOps/IT engineers. "Diagnose", "Run agent", "Approve change", "Reject", "Was this useful?", "Build passed", "Handed to you: this needs access the agent doesn't have". Never invent statistics.

## Finishing checklist
- [ ] Only token colours; one blue action visible per view.
- [ ] Headings Newsreader, body Geist, logs Geist Mono.
- [ ] Pills/16px/12px radii; 1px borders; only the log input has a shadow.
- [ ] All model text rendered as text (no `dangerouslySetInnerHTML`).
- [ ] Loading, empty and error states exist.
- [ ] Focus ring visible, targets ≥ 44px, icon buttons labelled, `aria-live` on results.
- [ ] Works at 360px and 1440px. `npm run build` passes.
