# Tavernfire: design notes

Carried over from the concept mockup so the real build matches it. Working name: Tavernfire.

## Look and feel

Warm parchment background, dark serif headings, muted colours and terracotta buttons. Friendly and readable, not an over-the-top fantasy interface. It is a tool for people who play fantasy games, not an in-game screen.

## Colours

| Role | Hex |
| --- | --- |
| Page background (parchment) | #F4EEE1 |
| Card surface | #FBF8F1 |
| Card border | #D9CFB8 |
| Spark chip background | #E8DFCB |
| Ink (main text) | #211D18 |
| Body text | #3F382F |
| Muted text | #5E564B |
| Input border | #B8AC90 |
| Accent (buttons, links) | #A93F24 |
| Accent hover | #7E2D18 |
| Teal (labels, type badges) | #1D5A57 |
| Dark panel | #211D18 with text #F4EEE1 |

All text pairs above meet at least 4.5:1 contrast on their backgrounds; keep it that way.

## Type

- Headings, spark chips, entry names: Fraunces (serif), weights 500 and 700
- Body and UI: Inter, weights 400, 500, 600
- Google Fonts; load only the weights above

## Layout

- Pages are fluid, with a centred container up to 1120px and 32px side padding
- Two columns on desktop (main content, then a 280px sidebar), stacking on narrow screens
- Touch targets at least 44px high
- Cards: `.card` 16px radius and 28px padding (20px on screens 480px and narrower); `.request-card` and the how-note 14px radius. Card titles are Fraunces weight 500

## Screens built in the mockup

1. **Request board (home):** header, hero with the post-a-request form, open requests list with filters (All, NPCs, Locations), sidebar with "How a request works" and "Browse sparks".
2. **Request page:** the three sparks large, requester note, answers in random order, add-your-answer form, sidebar with "Close matches" and "Made by people".

## Key components

- **Spark chip:** large serif word on a #E8DFCB background, three per request
- **Request card:** three spark chips, type badge, note, answer count, requester, time left
- **Entry card:** name, description, trait pills, "Used in N games", buttons (Save to collection, I used this, Report entry), vote button
- **Hidden during voting:** author name and vote totals (say "Author revealed after voting")

## Wording

- A **spark** is a single word that starts an idea; a request has three
- **Traits** are the author-chosen descriptors on an entry (separate from sparks)
- Use "Report entry", not "Flag as AI"
- Use "I used this" for the self-reported usage counter

## Tokens added after the design review

- `--error` #9B2C1A for error text
- Warning notice: background #F6E9D3, border #A8741A
- `--control-border` #8A7D60 for input, tab and outline-button borders (meets the 3:1 contrast needed for form controls on parchment and surface). Decorative card borders keep `--border`
- Placeholder text uses `--muted` at full opacity

## Small components

- **Time pill (`.time-left`):** shows time left on a request; turns `.time-left-soon` (#F6E0D8 background, accent text, 4.84:1) when under 24 hours remain
- **How-note (`.how-note`):** light note with a serif title and four numbered steps; replaces the dark card
- **Spark errors:** the box that is wrong gets an error border and `aria-invalid`, focus moves to it, the message names the word, and joined words offer a one-tap "Use 3-Heads" fix.
- **Signed-out example:** a labelled "Example request" with three non-interactive spark chips (Statue, Time, Glowing) above "Sign in to post". Replaced the disabled inputs after round 2b

## Deviations from the design review

See `claude/lead-agent-response-2026-11-18.md` in the Project. In short: header search, the phase strip and board sorting are deferred until the library, lifecycle functions and extra pages exist; the "Request posted" notice is kept but delayed 700ms so it only shows if opening the request is slow.

## Answers (Slice A)

- **Entry card:** name (Fraunces 700, 22px), description (16px, 65ch max, line breaks kept), trait pills, then a footer with "Author revealed after voting" and a quiet "Report entry" (muted, underlined, 44px tall). Your own entry is pinned first with a "Your entry" badge, says "You wrote this", and has no report link. After submitting, a "Your answer is in. You can edit it for 24 hours after posting (never once answers close)." notice appears.
- **Trait pills:** 13px Inter 500, teal #1D5A57 on #E6EFE9 with a teal border (6.7:1). Deliberately small and rounded so they never read as spark chips.
- **Answer form:** name, description, traits (Enter or comma adds a pill; each pill has a remove button with a 44px tap area), no "How a GM could use it" field; live counters at the top right of each label ("n of 60", "n of 600", "n of 5"); NPC and Location have different placeholders.
- **States:** signed out ("Sign in to answer"), requester ("This is your request"), already answered (form gone, entry pinned), answers closed, none (form shown directly), one, many, reported.
- **Left out on purpose until they work:** vote button, Save to collection, I used this, "Used in N games".
- Order is random per viewer and fixed for the session; "in random order" shows only with 2 or more entries.
- Everything under "Answers" shares one 720px column. On phones (480px and narrower): the signed-in name is hidden so the header fits one row, board cards drop "Posted by", and the Submit button is full width. The board card folds the type badge into the meta row.
- Time left is clamped to the 3-day window, so a device clock slightly behind the server never shows "4 days left".

## Editing your own answer

- Your own card shows a quiet "Edit · 23 hours left" link. It opens the answer form, pre-filled, in place of the card, with "Save changes" and "Cancel" and the same counters; a "Saved." line follows.
- The window is 24 hours from the original posting (editing never restarts it) and ends early when the request stops accepting answers. After it ends the link is replaced by "Entries are locked 24 hours after posting."
- Only name, description and traits can change. An edited entry shows a small muted "· Edited" after the author line, to everyone.
- Reporting an entry locks it against edits (the author is not told it was reported; a refused save just says it can no longer be edited).
