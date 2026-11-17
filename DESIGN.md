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
- Cards: 14px radius, 1px border, 22 to 24px padding

## Screens built in the mockup

1. **Request board (home):** header, hero with the post-a-request form, open requests list with filters (All, NPCs, Locations), sidebar with "How a request works" and "Browse sparks".
2. **Request page:** the three sparks large, requester note, answers in random order, add-your-answer form, sidebar with "Close matches" and "Made by people".

## Key components

- **Spark chip:** large serif word on a #E8DFCB background, three per request
- **Request card:** three spark chips, type badge, note, answer count, requester, time left
- **Entry card:** name, concept, trait pills, an "At your table" panel, "Used in N games", buttons (Save to collection, I used this, Report entry), vote button
- **Hidden during voting:** author name and vote totals (say "Author revealed after voting")

## Wording

- A **spark** is a single word that starts an idea; a request has three
- **Traits** are the author-chosen descriptors on an entry (separate from sparks)
- Use "Report entry", not "Flag as AI"
- Use "I used this" for the self-reported usage counter
