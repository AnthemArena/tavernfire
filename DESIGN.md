# Tavernfire: design notes

How the site looks and reads, matched to what is built. If this and the code disagree, the code wins; fix this file. Tokens live at the top of `src/app/globals.css`. Screens use tokens only, so a new colour is added to both themes.

## The model in one paragraph

Members **light a fire**: three one-word **sparks** plus a **type** (NPC, Location, Item or Creature) and an optional note. Other members **answer** the fire (a name, a description, up to five traits). People **stoke** fires they want answered and **upvote** answers they like. Upvotes and stokes earn XP and ranks. The **Library** searches fires by spark. The **Answers** page lists answers across all fires. Fires is the front door; Answers is the content.

## Look and feel

Dark is the default theme: near-black with gold accents. A light parchment theme is the alternative, switched from the footer or Settings > Appearance and remembered in the browser (`:root` is dark, `:root[data-theme="light"]` is light). Friendly and readable, not an over-the-top fantasy interface. It is a tool for people who play fantasy games, not an in-game screen.

## Colour tokens

| Token | Dark (default) | Light |
| --- | --- | --- |
| `--parchment` page background | #131211 | #F4EEE1 |
| `--surface` card | #1D1B18 | #FBF8F1 |
| `--border` card border | #36322B | #D9CFB8 |
| `--chip` spark chip | #2B2721 (hairline #5A4A22) | #E8DFCB |
| `--ink` / `--body` / `--muted` | #F2EBDC / #D9D1C0 / #A99F8D | #211D18 / #3F382F / #5E564B |
| `--control-border` | #8C8068 | #8A7D60 |
| `--accent` links, primary buttons, focus | #D4AF37 (hover #E6C35C) | #A93F24 (hover #7E2D18) |
| `--on-accent` text on accent | #14110C | #FFFFFF |
| `--teal` labels, type badges, success | #7FC8BD | #1D5A57 |
| `--error` | #FF9B86 | #9B2C1A |
| `--warn-text` | #E8B4A0 | #8A3B1F |

Gold is the one action colour in dark; terracotta is the light theme's. Text pairs meet 4.5:1 and form control borders 3:1; check any new pair in both themes. Decorative card borders use `--border`; controls (inputs, tabs, outline buttons) use `--control-border`. Placeholder text uses `--muted` at full opacity.

## Type

- Headings, spark chips, answer names, card titles: Fraunces (serif), weights 500 and 700
- Body and UI: Inter, weights 400, 500, 600
- Load only those weights
- Eyebrow labels and kickers are 15px sentence case, never all caps

## Layout

- One frame for every page: a centred container up to 1120px with 32px side padding (20px on phones), the same as the header, so the left edge matches across pages.
- Inside the frame, content keeps a readable column, left aligned: form pages (Light a fire, Settings, sign-in) 520px; Library and Answers 720px; fire page and profile use the wide frame.
- The Fires board is two columns on desktop (list, then a "How a fire works" side box) and stacks under 940px, where the side box folds above the list.
- Touch targets at least 44px high.
- Cards: `.card` 16px radius and 28px padding (20px at 480px and under); board cards 14px radius.
- Spacing on list pages: tabs, then type filter, then the list, each with its own gap (the pills never touch the first card).

## Screens

1. **Fires (home):** header, hero, then the board. Sorts as underlined text tabs on the left (Trending, Most stoked, New, Unanswered); the type filter as pills on the right (All types, NPCs, Locations, Items, Creatures). A compact select replaces the pills on phones. The hero is full for visitors (heading, one line, "Light a fire" and "Browse answers", plus a showcase card with the day's featured answer and its author) and compact for signed-in members (smaller heading and one line, no showcase). A member hint in localStorage stops either from flashing.
2. **Fire page:** back link, type badge, the three sparks (chips that open the Library), note, "Lit by X, age", stoke control, "Write an answer" button when there are no answers, the answers, the answer form.
3. **Light a fire:** three spark boxes, a type choice with nothing preselected, an optional 300-character note with a counter in its label, "Posting as X. Change".
4. **Answers:** "What people have made for other tables." Sort tabs (Most upvoted, New), type filter, then answer cards in a 720px column, 30 at a time with "Show more".
5. **Library:** one spark per search, suggestions with fire counts, results as fire cards, and the "Popular sparks" cloud (with counts) which stays under results.
6. **Profile:** avatar, name, rank and progress, stats (Upvotes received, Stokes received), Fires and Answers lists, Achievements.
7. **Settings:** display name, avatar, Appearance (Dark/Light), sign out. Sign-in and email-action pages use the form frame.
8. **Moderation:** for moderators only; hides, clears and restores answers, with a log.

## Components

- **Spark chip:** Fraunces word on `--chip`, three per fire. On the fire page and Answers cards it is a link to the Library (`a.spark-link`); on whole-card links (board, Library results) it is plain text because links cannot nest.
- **Type badge:** teal label (NPC, Location, Item, Creature).
- **Fire card (board):** the whole card is one link. Three chips, type, note clamped to two lines, top answer (name and a two-line snippet), counts at the right edge (stokes only above 0, then answers; only the flame is gold), "Lit by X, age".
- **Answer card (Answers page):** left column with the boxed upvote control; body with type badge, name (links to `/fires/<id>#entry-<answerId>`), spark chips, description (65ch, three-line clamp), footer "Author, age" and "See this fire", then "Fire lit by X, age".
- **Entry card (fire page):** name, description, trait pills, "by Author, age", the upvote control, report link. Your own answer is pinned first with a "Your entry" badge, says "You wrote this", and can be edited for 24 hours (or until answers close). It has a static upvote control that says "You can't upvote your own answer". After the window: "Entries are locked 24 hours after posting."
- **Upvote and stoke controls:** one boxed control. Signed out, pressing it shows "Sign in to upvote" or "Sign in to stoke fires" in place (no redirect). Unverified email shows the verify notice.
- **Top-answer snippet (`TopAnswer`):** name plus snippet, clamped to 2 lines on the board and 1 in the Library. Snippets never end in punctuation before the ellipsis.
- **Trait pills:** 13px Inter 500, teal on a teal tint with a border. Small and rounded so they never read as spark chips.
- **Rank badge and progress:** ranks are Cinderling 0, Flamebearer 50, Pyromancer 150, Blazewalker 400, Phoenix Ascendant 1000 XP. Progress reads "45 XP, 5 more to Flamebearer". Rank and the XP sentence live on the own profile, not in Settings.
- **Notifications:** bell with an unread count, unread items marked, "Mark all as read". Answer and upvote notifications open the answer on its fire page. Achievement text is `Achievement unlocked: "Name"`. Toasts group repeated events.
- **How-note:** light note with a serif title and numbered steps; folded above the list under 940px.
- **Time pill:** shown while a fire is accepting answers; turns warm under 24 hours left.
- **Skeleton cards** while the board loads; empty states always offer a way forward (a "Light a fire" or "Browse fires" button).

## Forms

- Spark errors mark the box that is wrong (error border, `aria-invalid`), move focus to it, name the word, and offer a one-tap hyphen fix ("Use 3-Heads"). Sparks are single words up to 24 characters.
- Answer form: name (60), description (600), traits (Enter or comma adds one, up to five, each with a 44px remove area), live counters beside each label ("n of 60"). The button reads "Post answer" / "Posting…". Placeholders differ by type.
- Nobody can answer their own fire; requesters see "This is your fire".
- States covered: signed out, requester, already answered, answers closed, none, one, many, reported, saving, refused save (the typed text is kept).

## Wording

- A **spark** is a single word that starts an idea; a fire has three.
- A **fire** is the request; to **light** one, to **stoke** one you want answered.
- An **answer** is what someone writes back (the code and data call it an entry).
- **Traits** are author-chosen descriptors on an answer, separate from sparks.
- "Lit by X, 2 days ago" on fires; "by X, 2 days ago" on answers.
- "Report entry", never "Flag as AI".
- Back link: "Back to Fires". Empty answers: "No answers yet. Be the first."
- Sentence case everywhere; no all-caps labels.

## Accessibility

- Route-aware `aria-current` in the header; visible focus ring in `--focus`.
- Status messages use `role="status"`; focus returns to the trigger after editing.
- Type and sort controls are real buttons with `aria-pressed`; own-answer controls have a title and an aria label saying why they are disabled.
- Still to check: contrast on muted text in the light theme, the notification panel's Escape, focus and phone behaviour, 44px targets on every link-style button.

## Not built yet

Fires board cards and Library results have no chip links or "Write an answer" button (whole-card links). No search of answers by spark, no fire page sidebar, no copy-with-credit button, no duels. See `claude/lead-agent-response-claude-agent-ui-review-2026-11-23.md` in the Project for the running list.
