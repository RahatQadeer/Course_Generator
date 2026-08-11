/**
 * The "Improve with AI" catalogue. Client-safe: the menu reads the labels,
 * the server editor reads the instructions.
 */

export const IMPROVE_ACTIONS = {
  simplify: {
    label: "Make simpler",
    instruction:
      "Rewrite at a lower reading level without losing correctness. Replace jargon with plain words (defining any term you must keep), shorten sentences, and add a concrete everyday analogy for the hardest idea. Keep every teaching point.",
  },
  detail: {
    label: "Make more detailed",
    instruction:
      "Deepen the explanation. For each main point add the mechanism behind it, a concrete specific, and where it breaks down. Add roughly 50% more substance — new information only, never restatement.",
  },
  examples: {
    label: "Add examples",
    instruction:
      "Add two more `example` blocks with named, concrete scenarios and real walkthroughs, placed where the explanation is most abstract. Keep the existing content intact.",
  },
  activity: {
    label: "Add an activity",
    instruction:
      "Add a hands-on practice step to the body as a `steps` block the learner can follow immediately after reading, using only what this lesson teaches.",
  },
  professional: {
    label: "Rewrite professionally",
    instruction:
      "Tighten the prose to publication standard. Remove filler, hedging and repetition. Make every sentence carry information. Preserve all teaching points, examples and structure.",
  },
  shorten: {
    label: "Shorten",
    instruction:
      "Cut roughly a third of the length by removing redundancy and padding, not teaching points. Merge overlapping paragraphs. Every remaining sentence must earn its place.",
  },
  expand: {
    label: "Expand",
    instruction:
      "Extend the lesson with the material a learner would ask for next: edge cases, common mistakes and how to recover from them, and one more worked example. Do not repeat what is already there.",
  },
  practical: {
    label: "Make more practical",
    instruction:
      "Shift the balance toward doing. Convert abstract explanation into concrete procedure, add real tool and command names where they exist, and make sure the learner could act on this immediately.",
  },
} as const;

export type ImproveAction = keyof typeof IMPROVE_ACTIONS;
