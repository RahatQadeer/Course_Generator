# CourseGen

An AI course generator. You describe a course; it produces a complete, structured,
professionally presented curriculum — modules, lessons, worked examples, activities,
quizzes and a final assessment — then lets you edit, regenerate, theme and export it.

This is a generator, not an LMS. There is no auth, no enrolment, no student side.

## Getting started

```bash
cp .env.example .env.local     # add your GEMINI_API_KEY
npm install
npm run dev                    # http://localhost:3210
```

Courses are stored in the browser's `localStorage` — there is no database and
nothing leaves your machine except the calls to the model provider.

## Providers

Google Gemini and Anthropic Claude are both supported. Whichever key is present
is used — `GEMINI_API_KEY` wins if both are set, and `COURSEGEN_PROVIDER` forces
the choice. Structured output uses each provider's native mechanism (Gemini's
JSON-schema mode, Anthropic's forced tool use) behind one interface in
`src/lib/ai/providers/`, so adding a third provider is a single file.

Each tier is a fallback chain, best model first. Gemini defaults to
`gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite`; when a model's daily
quota runs out mid-run the client drops to the next one and keeps going, and the
finished course records which models actually wrote it.

### Rate limits

This matters more than it sounds. A three-module course is roughly 30 API calls,
while Google's **free tier allows about 5 requests per minute and 20 per day** on
its best flash model — so a free key will finish a course, but the later stages
get written by a weaker model. The client is built for this:

- requests are paced per model, and the pacer lowers its own ceiling the first
  time the API discloses the real limit;
- a 429 is honoured for exactly as long as the API asks, and the wait applies to
  every other in-flight request for that model, not just the one that failed;
- an exhausted per-day quota is fatal rather than silently producing a partial
  course, unless another model in the chain can take over.

On a billed key none of this engages. For a real quality gain there, put the Pro
model first: `COURSEGEN_MODEL_REASONING=gemini-3.1-pro-preview,gemini-3.6-flash`.

### Gemini schema quirk

Gemini rejects a request outright when an array of complex objects carries
`minItems` above about four — it appears to expand the item schema that many
times during constrained decoding. `src/lib/ai/providers/gemini-schema.ts` strips
those bounds for Gemini only; Zod still enforces the real counts on the response
and the prompts state them in words. `npm run check:schemas` fails if a schema
reintroduces the problem.

## The generation pipeline

Generation is nine stages, not one giant prompt. Each stage is a separate service
with its own Zod schema, and progress streams to the browser over SSE.

| # | Stage | Service | What it does |
|---|-------|---------|--------------|
| 1 | Analyse | `coursePlanner.analyzeBrief` | Sharpens the brief, maps the subject's real dependency order, fixes scope |
| 2 | Objectives | `coursePlanner.generateObjectives` | Assessable, Bloom-verb course objectives |
| 3 | Curriculum | `curriculumGenerator.generateModulePlan` | The module arc and its progression rationale |
| 4 | Modules | `curriculumGenerator.generateLessonPlan` | Per-module lesson breakdown with a beat-by-beat outline |
| 5 | Lessons | `lessonGenerator.generateLessonBody` | The lesson bodies, written in parallel |
| 6 | Activities | `lessonGenerator.generateModuleActivities` | Practice activities and retrieval-practice checks |
| 7 | Quizzes | `quizGenerator` | Lesson quizzes and module assessments, grounded in the generated text |
| 8 | Assessment | `assessmentGenerator` | A synthesis-weighted final assessment |
| 9 | Quality | `courseValidator` | Deterministic checks + an AI review, then auto-repairs what it can |

Two properties matter most:

**Quizzes cannot test untaught material.** Question generation receives the actual
generated lesson text, not the plan, and every question records the lesson it came from.

**Nothing crashes on bad model output.** `generateStructured` asks for structured output
against a JSON Schema derived from Zod, salvages JSON from prose if the provider returns
text, feeds validation errors back for a repair pass, retries transport failures with
backoff, and falls through to the next model in the tier when one runs out of quota. A
lesson that still fails is marked `failed` and the course completes without it.

## Quality check

Stage 9 combines checks that can be known for certain (empty lessons, questions with no
valid answer, duplicate titles, malformed options) with a model review of content accuracy,
progression and objective coverage. Lessons flagged critical or major are automatically
rewritten with the reviewer's fix instruction before the course is returned. The result is
an overall score plus four sub-scores: structure, content, objective alignment, assessment.

## Source material

Optional. Supported: PDF, DOCX, PPTX (slides + speaker notes), TXT, MD, CSV, HTML,
any web page, YouTube videos with captions, and pasted text. When present it becomes the
authoritative basis for the curriculum rather than a hint.

## Editing and regeneration

Regeneration is scoped — a lesson, a module, a quiz, the final assessment or the whole
review pass, never more than you asked for. "Improve with AI" offers eight framings
(simpler, more detailed, add examples, add an activity, more practical, rewrite
professionally, shorten, expand) plus a free-form instruction. Everything is also
directly editable: click any text, or switch a lesson to Edit for a block-level editor.

## Themes and export

Seven themes (Modern, Academic, Corporate, Minimal, Technology, Creative, Dark), each a
flat set of CSS variables, with per-course overrides for primary colour, accent, typeface,
corner radius and card style. The preview, the PDF and the HTML export all render from the
same tokens, so what you see is what ships.

Export: PDF (via the browser's print pipeline against the themed preview), a self-contained
HTML file with no external assets, and the raw course JSON. New formats register in
`src/lib/export/index.ts`.

## Layout

```
src/
  app/
    page.tsx                    create + generation progress
    course/[id]/                the workspace
    course/[id]/preview/        themed preview, print target for PDF
    api/generate/               SSE, runs the full pipeline
    api/ai/                     SSE, runs a scoped regeneration or edit
    api/ingest/                 source material extraction
  services/ai/                  one file per generation concern
  lib/
    ai/                         client, prompts, pipeline, operations, stages
    ingest/                     pdf, docx, pptx, url, youtube
    export/                     html, json, registry
    schema/course.ts            the course model (Zod, single source of truth)
    course-ops.ts               pure immutable tree operations
    store.ts                    zustand + localStorage autosave
  components/
    create/  generate/  workspace/  preview/  course/  ui/
```

## Checks

```bash
npm run typecheck
npm run lint
npm run smoke          # fixture → validation → quality check → HTML export, no API calls
npm run check:schemas  # every AI schema converts to something both providers accept
npm run build
```
