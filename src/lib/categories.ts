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
  /** Placeholder in the Name box. */
  namePlaceholder: string;
  /** Placeholder in the Description box. */
  conceptPlaceholder: string;
  /** What the optional tags are called ("Traits", "Features"…). Singular form is derived. */
  tagsLabel: string;
  /** Placeholder in the tags box when it is empty. */
  tagsPlaceholder: string;
};

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
    description: "A place: what it is like, and what is hidden there.",
    launched: true,
    answer: {
      namePlaceholder: "e.g. The Hollow Observatory",
      conceptPlaceholder: "What is this place like? What is hidden here?",
      tagsLabel: "Traits",
      tagsPlaceholder: "e.g. damp, abandoned, humming",
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
