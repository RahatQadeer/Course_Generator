/** A realistic course fixture used by the smoke tests. */
import { courseSchema, type Course } from "../src/lib/schema/course";

export function makeCourse(): Course {
  const raw = {
    id: "course_demo01",
    title: "Month-End Close for Retail Bookkeeping",
    subtitle: "Close a small retail client's books accurately in under three days.",
    description:
      "A hands-on course for independent bookkeepers who handle month-end for small retail businesses. You will build a repeatable close checklist, reconcile the accounts that break most often, and produce a management pack the owner can act on.",
    audience: "Independent bookkeepers with one to five small retail clients.",
    difficulty: "beginner",
    duration: "4 weeks",
    estimatedHours: 12,
    prerequisites: ["Comfortable with double-entry bookkeeping", "Access to a cloud ledger"],
    learningObjectives: [
      "Build a month-end close checklist tailored to a retail client",
      "Reconcile bank, card and till accounts and resolve the differences",
      "Produce a management pack the owner can act on",
    ],
    outcomes: ["A reusable close checklist", "A reconciled trial balance", "A one-page management pack"],
    themeId: "modern",
    finalAssessment: {
      id: "quiz_final",
      title: "Final Assessment",
      description: "Covers the whole close cycle.",
      passingScore: 70,
      questions: [
        {
          id: "q_f1",
          type: "multiple-choice",
          question:
            "A till float of 200 was counted as 180 at close on the 31st. Where does the 20 belong before the cause is known?",
          options: ["Cash over/short", "Retained earnings", "Directors loan", "Suspense as a fixed asset"],
          correctOptionIndexes: [0],
          explanation:
            "Unexplained till differences go to cash over/short so they stay visible; retained earnings would bury the variance until year end.",
          difficulty: "beginner",
          points: 1,
        },
        {
          id: "q_f2",
          type: "true-false",
          question: "A bank reconciliation is complete once the closing balance matches the statement.",
          options: ["True", "False"],
          correctOptionIndexes: [1],
          explanation:
            "The balances can agree while individual items are misposted. Every reconciling item must also be identified and aged.",
          difficulty: "beginner",
          points: 1,
        },
      ],
    },
    quality: {
      overall: 91,
      dimensions: {
        structure: { score: 93, notes: "Clean progression from setup to reporting." },
        content: { score: 90, notes: "Concrete and specific; the till example is well chosen." },
        objectiveAlignment: { score: 92, notes: "Every lesson maps to a stated objective." },
        assessment: { score: 88, notes: "Questions test application rather than recall." },
      },
      issues: [
        {
          severity: "minor",
          area: "Content",
          detail: "Lesson 1.2 could name a specific ledger product.",
          fixed: false,
        },
      ],
      strengths: ["Scope is honest", "Activities are genuinely executable"],
    },
    meta: {
      topic: "Month-end close for small retail bookkeeping clients",
      language: "English",
      teachingStyle: "practical",
      sourceNames: [],
      generatedAt: new Date("2026-08-11T09:00:00Z").toISOString(),
      model: "claude-sonnet-5",
    },
    updatedAt: new Date("2026-08-11T09:00:00Z").toISOString(),
    modules: [
      {
        id: "module_1",
        title: "Setting Up a Repeatable Close",
        description:
          "Turn an ad-hoc scramble into a checklist you run the same way every month, with a fixed cut-off and named owners.",
        learningObjectives: ["Define a close calendar", "Build a checklist tailored to a retail client"],
        quiz: {
          id: "quiz_m1",
          title: "Setting Up a Repeatable Close — Module Assessment",
          description: "Checks that you can design a close process, not just describe one.",
          passingScore: 70,
          questions: [
            {
              id: "q_m1",
              type: "multi-select",
              question: "Which items belong on day one of a retail close checklist? Select all that apply.",
              options: [
                "Freeze the sales cut-off",
                "Export card settlement reports",
                "File the VAT return",
                "Issue the management pack",
              ],
              correctOptionIndexes: [0, 1],
              explanation:
                "Day one is about capturing data before it changes. Filing and reporting depend on reconciliations that have not run yet.",
              difficulty: "beginner",
              points: 2,
            },
          ],
        },
        lessons: [
          {
            id: "lesson_1_1",
            title: "Fixing the Cut-Off",
            summary: "Decide what belongs in the month, and stop the ledger moving underneath you.",
            durationMinutes: 18,
            difficulty: "beginner",
            learningObjectives: ["Set a cut-off date and enforce it in the ledger"],
            introduction:
              "Most late closes are not caused by hard accounting. They are caused by transactions arriving after you thought the month was finished.",
            outline: ["Define cut-off", "Lock the period", "Handle late invoices"],
            status: "ready",
            content: [
              {
                id: "b1",
                type: "paragraph",
                text: "A cut-off is the moment you stop accepting new transactions into a period. Without one, a supplier invoice dated the 30th can land on the 6th of the next month and silently change a figure you already reported.",
              },
              { id: "b2", type: "heading", text: "Locking the period", level: 2 },
              {
                id: "b3",
                type: "steps",
                title: "Enforcing the cut-off",
                steps: [
                  { title: "Agree the date", detail: "Pick a working day, not a calendar day, and put it in writing with the client." },
                  { title: "Lock the ledger", detail: "Set the lock date in your accounting software so postings before it require an override." },
                  { title: "Route late items", detail: "Anything arriving after the lock goes into next month with a note explaining why." },
                ],
              },
              {
                id: "b4",
                type: "callout",
                variant: "warning",
                title: "The classic trap",
                text: "Locking the period without telling the client produces a queue of failed postings and an angry phone call. Announce it a week before the first close.",
              },
              {
                id: "b5",
                type: "example",
                title: "A late supplier invoice",
                scenario:
                  "A stock invoice dated 30 April arrives on 6 May, after the April lock. Gross 1,200.",
                walkthrough: [
                  "Check whether the goods were received in April — if they were, the cost belongs in April.",
                  "Because the ledger is locked, post an accrual dated 30 April rather than the invoice itself.",
                  "Reverse the accrual on 1 May and post the invoice normally.",
                ],
                outcome: "April's cost of sales is right, and May's ledger stays clean.",
              },
              {
                id: "b6",
                type: "table",
                caption: "Where late items go",
                headers: ["Arrives", "Goods received", "Treatment"],
                rows: [
                  ["Before lock", "In month", "Post normally"],
                  ["After lock", "In month", "Accrue and reverse"],
                  ["After lock", "Next month", "Post next month"],
                ],
              },
            ],
            keyTakeaways: [
              "A cut-off is a date plus an enforcement mechanism; a date alone does nothing.",
              "Accruals let you respect the lock without misstating the month.",
              "Announce the lock to the client before the first close, not after.",
            ],
            activities: [
              {
                id: "act_1",
                title: "Draft a cut-off policy",
                type: "exercise",
                instructions: [
                  "Pick one of your clients and write a two-sentence cut-off policy naming the working day.",
                  "List the three transaction types most likely to arrive late for that client.",
                  "Write the treatment you will apply to each.",
                ],
                estimatedMinutes: 20,
                successCriteria: ["The policy names a specific day", "Each late type has a stated treatment"],
              },
            ],
            knowledgeChecks: [
              {
                id: "kc_1",
                prompt: "Why is an accrual preferable to overriding the ledger lock?",
                answer:
                  "The accrual keeps the cost in the correct period while leaving the lock — and therefore the audit trail — intact.",
              },
            ],
            quiz: {
              id: "quiz_l11",
              title: "Fixing the Cut-Off — Knowledge Check",
              passingScore: 70,
              questions: [
                {
                  id: "q_l11_1",
                  type: "short-answer",
                  question: "Describe what should happen to an invoice dated inside the month that arrives after the lock, for goods received in the month.",
                  options: [],
                  correctOptionIndexes: [],
                  sampleAnswer:
                    "Accrue the cost on the last day of the locked month, then reverse the accrual and post the invoice in the following month.",
                  explanation:
                    "This keeps the expense in the period the goods were received without breaking the lock.",
                  difficulty: "beginner",
                  points: 2,
                },
              ],
            },
          },
        ],
      },
    ],
  };

  return courseSchema.parse(raw);
}
