# Tavernfire

A community site where tabletop RPG players and game masters swap ideas, started by three sparks. Live at [tavernfire.com](https://tavernfire.com) (being connected; the app also runs on its Firebase App Hosting address).

## The idea in one line

Someone lights a fire: three sparks and what they need. The community answers with something made by a person, the best answers rise, and every answer stays in a library anyone can search.

## Vocabulary

- **Spark:** a single word that starts an idea (for example *Statue*, *Time*, *Glowing*). A fire has three sparks.
- **Fire:** a request. Three sparks plus the type of thing needed (NPC, location, item or creature to start), with an optional note about the table or session. Fires stay open.
- **Answer:** one person's response to a fire: a name, a description, and up to five optional traits. Shown under the author's name.
- **Traits:** the author-chosen descriptors on an answer (for example *Ancient, Patient, Guardian*). Not the same thing as sparks.
- **Stoke:** a vote on the fire itself ("good fire", a question worth answering).
- **Upvote:** a vote on an answer ("good answer").
- **Duel:** a planned second mode: anonymous, timed head-to-head competitions (see below).

## How it works (current design)

1. **Light a fire.** Choose three sparks and a type. Optionally add context, such as party level or tone.
2. **Anyone can answer, at any time.** Answers carry the author's chosen name and link to their public profile. You can't answer your own fire, and you answer each fire once. You can edit an answer for 24 hours.
3. **People vote, as much as they like.** Upvote answers and stoke fires. One vote per person per item, no cap on how many things you can vote on, and no voting for your own answers or fires. Voting needs a verified email.
4. **Fires are found three ways.** *Trending* (recent stokes and upvotes, fading over a few days), *Top* (most stoked) and *New*.
5. **Everything is kept.** Every answer stays filed under its three sparks, ranked by upvotes, for the Library.

There is deliberately no contest, deadline or reveal for ordinary fires: the site isn't trying to be competitive. (An earlier design had a 3-day answer window, blind voting and a reveal. That code is kept for duels. See `DEVELOPMENT.md`.)

## Discovery

- **Fires page:** Trending, Top and New, with a filter by type.
- **Library (planned):** search by spark. Search one, two or all three sparks; exact matches rank first, then close matches that share two of three. Ranked by upvotes.
- **By trait (planned):** author-chosen, capped at about five per answer, with suggestions drawn from existing traits to avoid near-duplicates (Ancient, Old, Aged).

Sparks rank above traits in search, and the interface keeps the two visibly separate.

## What is built and what is next

**Built and live**
- Sign-in with Google or email (with verification emails and a custom email-link page)
- Chosen display names (unique, changeable every 7 days)
- Light a fire (NPC, location, item, creature), the Fires page with Trending, Top and New
- Answers with a consistent template, edit for 24 hours
- Upvotes on answers, Stoke on fires, counted by Cloud Functions
- Public profiles at `/profile/<id>` (name, member since, fires, answers, upvotes received)
- Account page (your fires and your answers)
- Report answer (reports are stored; moderator tools are not built yet)

**Next**
- Library: search by spark and by trait
- Before launch: clear test data, connect the domain and set the email action URL, create moderator tools and a moderator role, terms and privacy pages

**Later**
- Duels and timed "blitz" modes (anonymous, one vote per match, hosted by an admin or on a schedule)
- Personal collections (for example per campaign) and an "I used this" counter
- Profile bio, avatar presets and image uploads, and reporting a profile
- Daily challenges, leaderboards, reputation levels
- More types: player characters, abilities, factions, spells, rumours, traps, plot hooks, adventure seeds
- Optional system-specific stat blocks (the default stays system-neutral)

Because all types share the same sparks, one set of three can eventually yield a full set: the NPC, the place they guard, the item they carry and the rumour that leads there.

## Made by people

The site is for things made by people. This is a shared community standard, not a guarantee, because AI-written text cannot be reliably detected.

- Authors submit only their own work. Answers are licensed to everyone under CC BY 4.0 (see the Terms page).
- Allowed: proofreading and spell-checking; using reference material for inspiration, with attribution where appropriate.
- Not allowed: asking an AI to generate or substantially rewrite the answer.
- **Report answer** (with reasons: AI-generated, plagiarism, spam, abuse) sends an answer to private moderator review. A report never penalises an author automatically.
- Authors can appeal.
- Account reputation builds over time; new accounts get more scrutiny.

## Seeding the library

An empty library is the biggest early risk, so it should be seeded deliberately.

- Look at actual-play shows and other tables for the kinds of things GMs need, then turn those needs into three-spark **fires**, not copied entries.
- Founding members write original answers to those fires. Seed entries are written by people and labelled as founding entries.
- Do not copy published creatures, named characters or stat blocks. Ideas and tropes are open; specific expression and trademarks are not. Get proper legal advice before launch.
- Folklore, mythology and medieval bestiaries are rich public-domain sources. Open game content (for example the D&D 5e SRD under Creative Commons, or Pathfinder's open licence) can be used under its own terms and attribution rules.
- Keep the seed small and strong: roughly 50 to 100 fires with a few good answers each, in the launch types.

## Licensing (to settle before public submissions)

Preferred direction: authors keep ownership, grant the site permission to display and distribute their answers, and other users receive a clear licence to use answers in personal tabletop games. Be explicit about attribution and whether commercial use (for example in a published adventure) is permitted.

## Validation

Measure, once there are real users:

| Measure | Why it matters |
| --- | --- |
| Fires receiving answers | Is there enough activity? |
| Time to first answer | Does it feel responsive? |
| Answers per fire | Are people motivated to contribute? |
| Upvotes and stokes per person | Are people engaging with each other's work? |
| Answers saved or used in games | Are the creations useful? |
| Returning contributors | Is creating enjoyable enough to repeat? |

The key question is whether people come back to create something for somebody else's table.

## Open questions

- Domain, trademark check and final name (Tavernfire is the working name; earlier candidates were Hookbook, Rumourmill, Wordhoard and Fablehoard)
- Whether the product is mainly a place to request and receive useful content, or a creative social community where fires are the mechanism
- How strict the AI policy is for assisted writing
- Licensing and ownership terms
- Early-answer advantage in an open list (a Top/Newest toggle exists; a short shuffled period for new answers is one idea)
- Which content types to add after launch, and in what order

## Developing

See `DEVELOPMENT.md` for setup, running, tests, deploying and Cloud Functions, `DATA_MODEL.md` for the Firestore design, and `DESIGN.md` for the visual design.
