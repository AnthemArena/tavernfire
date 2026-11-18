// Every request type ("category") in one place.
//
// The form, the board, the request page and the answer form all read from this
// list, so adding a category means adding one entry here (and one word in
// firestore.rules, which the tests check). Rules for the list:
//
// - `id` is stored in the database and never changes. Rename a category by
//   changing `label`, not `id`, so no data has to be migrated.
// - Every category uses the same answer shape: name, description, optional tags.
//   Only the wording differs. Do not add per-category fields.
// - `launched: false` keeps a category in code but out of the UI and out of
//   firestore.rules, so it cannot be posted yet.

export type CategoryAnswerCopy = {
  /** Label of the Name box. Defaults to "Name". */
  nameLabel?: string;
  /** An optional short line under the answer form, e.g. "No stats needed." */
  help?: string;
  /** Placeholder in the Name box. */
  namePlaceholder: string;
  /** Placeholder in the Description box. */
  conceptPlaceholder: string;
  /** What the optional tags are called ("Traits", "Features"…). Singular form is derived. */
  tagsLabel: string;
  /** Placeholder in the tags box when it is empty. */
  tagsPlaceholder: string;
};

/** Group names, used to group the picker once it has many options. */
export type CategoryGroup = "Characters" | "Things" | "Places and worlds" | "Scenes and story" | "At the table";

/** Switch the post form from a radio list to a compact picker at this many options. */
export const COMPACT_PICKER_FROM = 5;

export const DEFAULT_NOTE_PLACEHOLDER = "Party level, tone, what the scene needs";

export type Category = {
  id: string;
  /** Short label for badges, e.g. "NPC". */
  label: string;
  /** Longer name for the post form's drop-down, e.g. "Non-player character (NPC)". */
  fullLabel: string;
  /** Label for the board filter, e.g. "NPCs". */
  filterLabel: string;
  /** One line, shown beside the option on the post form, saying what it is for. */
  description: string;
  launched: boolean;
  /** For grouping the compact picker. */
  group: CategoryGroup;
  /** Placeholder in the requester's optional note. Defaults to DEFAULT_NOTE_PLACEHOLDER. */
  notePlaceholder?: string;
  answer: CategoryAnswerCopy;
};

export const CATEGORIES = [
  {
    id: "npc",
    label: "NPC",
    fullLabel: "Non-player character (NPC)",
    filterLabel: "NPCs",
    description: "A character the GM plays: who they are, how they look, what they want.",
    launched: true,
    group: "Characters",
    answer: {
      namePlaceholder: "e.g. Vhane, the Last Hour",
      conceptPlaceholder: "Who are they? What do they look like, and what do they want?",
      tagsLabel: "Traits",
      tagsPlaceholder: "e.g. patient, grieving, cold",
    },
  },
  {
    id: "location",
    label: "Location",
    fullLabel: "Location",
    filterLabel: "Locations",
    description: "A place: what it is like, and what happens there.",
    launched: true,
    group: "Places and worlds",
    answer: {
      namePlaceholder: "e.g. The Hollow Observatory",
      conceptPlaceholder: "What is this place like? What is hidden here?",
      tagsLabel: "Traits",
      tagsPlaceholder: "e.g. damp, abandoned, humming",
    },
  },
  // Wave 2, drafted but not launched: not in the UI, not in firestore.rules.
  {
    id: "item",
    label: "Item",
    fullLabel: "Item",
    filterLabel: "Items",
    description: "An object: what it is, what it looks like, and what makes it special.",
    launched: false,
    group: "Things",
    notePlaceholder: "Who carries it, what level, what it should feel like",
    answer: {
      namePlaceholder: "e.g. The Lantern of Second Chances",
      conceptPlaceholder: "What is it? What does it look like, and what is its story?",
      tagsLabel: "Features",
      tagsPlaceholder: "e.g. cursed, heavy, humming",
    },
  },
  {
    id: "creature",
    label: "Creature",
    fullLabel: "Creature",
    filterLabel: "Creatures",
    description: "A monster or animal: how it looks, how it behaves, and what it wants.",
    launched: false,
    group: "Characters",
    notePlaceholder: "Where it lives, how dangerous it should be, party level",
    answer: {
      namePlaceholder: "e.g. The Glasswing Moth",
      conceptPlaceholder: "What is it? How does it look and behave, and where does it live?",
      tagsLabel: "Traits",
      tagsPlaceholder: "e.g. nocturnal, territorial, venomous",
    },
  },
] as const satisfies readonly Category[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/** Categories people can post requests in today. */
export const LAUNCHED_CATEGORIES: readonly Category[] = CATEGORIES.filter((c) => c.launched);

export function isCategoryId(value: unknown): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) as Category;
}

/** Whether the post form should use the compact picker for this many options. */
export function isCompactPicker(optionCount: number): boolean {
  return optionCount >= COMPACT_PICKER_FROM;
}

/** Launched categories grouped for the compact picker, in the order groups first appear. */
export function groupedCategories(list: readonly Category[]): { group: CategoryGroup; items: Category[] }[] {
  const out: { group: CategoryGroup; items: Category[] }[] = [];
  for (const c of list) {
    let g = out.find((x) => x.group === c.group);
    if (!g) {
      g = { group: c.group, items: [] };
      out.push(g);
    }
    g.items.push(c);
  }
  return out;
}
