import {
  DIFFICULTY_LABEL,
  QUESTION_TYPE_LABEL,
  countLessons,
  countQuestions,
  totalMinutes,
  type ContentBlock,
  type Course,
  type Lesson,
  type Question,
  type Quiz,
} from "@/lib/schema/course";
import { getTheme, themeCssVars, type ThemeOverrides } from "@/lib/themes";
import { formatMinutes } from "@/lib/utils";

/** A single, self-contained HTML file — no external assets, no scripts required. */
export function courseToHtml(course: Course, overrides: ThemeOverrides = {}): string {
  const theme = getTheme(course.themeId);
  const vars = themeCssVars(theme, overrides);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(course.title)}</title>
<meta name="description" content="${esc(course.description.slice(0, 200))}">
<style>
:root {
${vars}
  --ct-font-heading: ${systemFont(theme.tokens.fontHeading)};
  --ct-font-body: ${systemFont(theme.tokens.fontBody)};
  --ct-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
}
${BASE_CSS}
</style>
</head>
<body>
<header class="hero hero--${theme.tokens.headerStyle}">
  <div class="wrap">
    <p class="eyebrow">${esc(DIFFICULTY_LABEL[course.difficulty])} · ${esc(course.duration)}</p>
    <h1>${esc(course.title)}</h1>
    ${course.subtitle ? `<p class="lede">${esc(course.subtitle)}</p>` : ""}
    <div class="stats">
      ${stat("Modules", String(course.modules.length))}
      ${stat("Lessons", String(countLessons(course)))}
      ${stat("Learning time", formatMinutes(totalMinutes(course)))}
      ${stat("Questions", String(countQuestions(course)))}
    </div>
  </div>
</header>

<main class="wrap">
  <section class="overview">
    <p class="intro">${esc(course.description)}</p>
    <div class="grid2">
      <div class="card">
        <p class="label">Who this is for</p>
        <p>${esc(course.audience)}</p>
      </div>
      ${
        course.prerequisites.length
          ? `<div class="card"><p class="label">Prerequisites</p><ul class="dots">${course.prerequisites
              .map((item) => `<li>${esc(item)}</li>`)
              .join("")}</ul></div>`
          : ""
      }
    </div>
    ${
      course.learningObjectives.length
        ? `<div class="card objectives">
            <h2>Learning objectives</h2>
            <ol class="numbered">${course.learningObjectives.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>
          </div>`
        : ""
    }
    ${
      course.outcomes.length
        ? `<h2>What you'll be able to do</h2><ul class="dots">${course.outcomes
            .map((item) => `<li>${esc(item)}</li>`)
            .join("")}</ul>`
        : ""
    }
  </section>

  <nav class="toc card">
    <p class="label">Contents</p>
    <ol>
      ${course.modules
        .map(
          (module, index) =>
            `<li><a href="#module-${index + 1}">${esc(module.title)}</a><span>${module.lessons.length} lesson${
              module.lessons.length === 1 ? "" : "s"
            }</span></li>`,
        )
        .join("")}
      ${course.finalAssessment ? `<li><a href="#final">Final assessment</a><span>${course.finalAssessment.questions.length} questions</span></li>` : ""}
    </ol>
  </nav>

  ${course.modules.map((module, index) => moduleHtml(module, index)).join("\n")}

  ${
    course.finalAssessment
      ? `<section id="final" class="module">
          <div class="module-head">
            <p class="eyebrow">Final assessment</p>
            <h2>${esc(course.finalAssessment.title)}</h2>
          </div>
          ${quizHtml(course.finalAssessment)}
        </section>`
      : ""
  }

  <footer class="foot">
    ${esc(course.title)} · ${course.modules.length} modules · ${countLessons(course)} lessons · generated ${new Date(
      course.meta.generatedAt,
    ).toLocaleDateString()}
  </footer>
</main>
</body>
</html>`;
}

/* -------------------------------------------------------------------------- */

function moduleHtml(module: Course["modules"][number], index: number): string {
  return `<section id="module-${index + 1}" class="module">
  <div class="module-head">
    <p class="eyebrow">Module ${index + 1}</p>
    <h2>${esc(module.title)}</h2>
    <p class="muted">${esc(module.description)}</p>
    ${
      module.learningObjectives.length
        ? `<ul class="dots small">${module.learningObjectives.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
        : ""
    }
  </div>
  ${module.lessons.map((lesson, lessonIndex) => lessonHtml(lesson, index, lessonIndex)).join("\n")}
  ${module.quiz ? `<div class="module-quiz">${quizHtml(module.quiz)}</div>` : ""}
</section>`;
}

function lessonHtml(lesson: Lesson, moduleIndex: number, lessonIndex: number): string {
  return `<article class="lesson">
  <p class="eyebrow small">Lesson ${moduleIndex + 1}.${lessonIndex + 1} · ${formatMinutes(lesson.durationMinutes)}</p>
  <h3>${esc(lesson.title)}</h3>
  ${lesson.summary ? `<p class="muted">${esc(lesson.summary)}</p>` : ""}
  ${
    lesson.learningObjectives.length
      ? `<div class="objstrip"><p class="label">By the end of this lesson</p><ul class="dots small">${lesson.learningObjectives
          .map((item) => `<li>${esc(item)}</li>`)
          .join("")}</ul></div>`
      : ""
  }
  ${lesson.introduction ? `<p class="intro">${esc(lesson.introduction)}</p>` : ""}
  ${lesson.content.map(blockHtml).join("\n")}
  ${
    lesson.keyTakeaways.length
      ? `<div class="card"><h4>Key takeaways</h4><ul class="ticks">${lesson.keyTakeaways
          .map((item) => `<li>${esc(item)}</li>`)
          .join("")}</ul></div>`
      : ""
  }
  ${lesson.activities.map(activityHtml).join("\n")}
  ${
    lesson.knowledgeChecks.length
      ? `<div class="checks"><h4>Check your understanding</h4>${lesson.knowledgeChecks
          .map(
            (check) =>
              `<details><summary>${esc(check.prompt)}</summary><p>${esc(check.answer)}</p></details>`,
          )
          .join("")}</div>`
      : ""
  }
  ${lesson.quiz ? quizHtml(lesson.quiz) : ""}
</article>`;
}

function activityHtml(activity: Lesson["activities"][number]): string {
  return `<div class="activity">
  <div class="activity-head"><span class="label">${esc(activity.type)}</span><span class="muted small">${formatMinutes(
    activity.estimatedMinutes,
  )}</span></div>
  <h4>${esc(activity.title)}</h4>
  <ol class="numbered">${activity.instructions.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>
  ${
    activity.successCriteria.length
      ? `<p class="label">You have succeeded when</p><ul class="dots small">${activity.successCriteria
          .map((item) => `<li>${esc(item)}</li>`)
          .join("")}</ul>`
      : ""
  }
</div>`;
}

function blockHtml(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${esc(block.text)}</p>`;
    case "heading":
      return block.level === 3 ? `<h5>${esc(block.text)}</h5>` : `<h4>${esc(block.text)}</h4>`;
    case "list":
      return block.ordered
        ? `<ol class="numbered">${block.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`
        : `<ul class="dots">${block.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
    case "callout":
      return `<aside class="callout"><p class="label">${esc(block.title || block.variant.replace("-", " "))}</p><p>${esc(
        block.text,
      )}</p></aside>`;
    case "code":
      return `<figure class="code"><div class="code-head">${esc(block.language)}</div><pre><code>${esc(
        block.code,
      )}</code></pre>${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}</figure>`;
    case "example":
      return `<section class="example">
        <div class="example-head"><p class="label">Example</p><h4>${esc(block.title)}</h4></div>
        <div class="example-body">
          <p>${esc(block.scenario)}</p>
          ${block.walkthrough.length ? `<ol class="numbered">${block.walkthrough.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>` : ""}
          ${block.outcome ? `<p class="outcome"><strong>Result — </strong>${esc(block.outcome)}</p>` : ""}
        </div>
      </section>`;
    case "steps":
      return `<section class="steps">${block.title ? `<h4>${esc(block.title)}</h4>` : ""}<ol>${block.steps
        .map((step) => `<li><strong>${esc(step.title)}</strong><span>${esc(step.detail)}</span></li>`)
        .join("")}</ol></section>`;
    case "table":
      return `<figure class="table"><table>
        <thead><tr>${block.headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead>
        <tbody>${block.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}</figure>`;
  }
}

function quizHtml(quiz: Quiz): string {
  const points = quiz.questions.reduce((sum, question) => sum + question.points, 0);
  return `<section class="quiz">
  <h4>${esc(quiz.title)}</h4>
  ${quiz.description ? `<p class="muted">${esc(quiz.description)}</p>` : ""}
  <p class="muted small">${quiz.questions.length} questions · ${points} points · pass at ${quiz.passingScore}%</p>
  <ol class="questions">${quiz.questions.map(questionHtml).join("")}</ol>
</section>`;
}

function questionHtml(question: Question, index: number): string {
  const correct = new Set(question.correctOptionIndexes);
  const options =
    question.type === "short-answer"
      ? `<div class="written">Written answer</div>${
          question.sampleAnswer
            ? `<details><summary>Model answer</summary><p>${esc(question.sampleAnswer)}</p></details>`
            : ""
        }`
      : `<ul class="options">${question.options
          .map(
            (option, optionIndex) =>
              `<li class="${correct.has(optionIndex) ? "correct" : ""}"><span class="key">${String.fromCharCode(
                65 + optionIndex,
              )}</span>${esc(option)}</li>`,
          )
          .join("")}</ul>`;

  return `<li class="question">
  <div class="q-head"><span class="num">${index + 1}</span><div><p class="stem">${esc(question.question)}</p>
  <p class="muted small">${esc(QUESTION_TYPE_LABEL[question.type])} · ${esc(question.difficulty)} · ${question.points} point${
    question.points === 1 ? "" : "s"
  }</p></div></div>
  ${options}
  ${question.explanation ? `<details class="why"><summary>Why</summary><p>${esc(question.explanation)}</p></details>` : ""}
</li>`;
}

function stat(label: string, value: string): string {
  return `<div class="stat"><p class="v">${esc(value)}</p><p class="l">${esc(label)}</p></div>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The app's webfonts are not available in a standalone file. */
function systemFont(stack: string): string {
  if (stack.includes("serif") && !stack.includes("sans-serif")) {
    return `Georgia, "Times New Roman", serif`;
  }
  if (stack.includes("mono")) return `ui-monospace, SFMono-Regular, Menlo, monospace`;
  return `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
}

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--ct-bg); color: var(--ct-text); font-family: var(--ct-font-body); font-size: 16px; line-height: 1.7; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 780px; margin: 0 auto; padding: 0 24px; }
h1, h2, h3, h4, h5 { font-family: var(--ct-font-heading); color: var(--ct-heading); letter-spacing: var(--ct-heading-tracking); margin: 0; }
h1 { font-size: 42px; line-height: 1.1; margin-top: 12px; }
h2 { font-size: 26px; line-height: 1.22; }
h3 { font-size: 21px; line-height: 1.28; }
h4 { font-size: 17px; }
h5 { font-size: 15.5px; }
p { margin: 0 0 14px; }
a { color: var(--ct-primary); }
.muted { color: var(--ct-muted); }
.small { font-size: 13px; }
.label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; color: var(--ct-primary); margin: 0 0 6px; }
.eyebrow { font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--ct-primary); margin: 0; }
.lede { font-size: 19px; color: var(--ct-muted); margin-top: 12px; max-width: 44em; }
.intro { font-size: 17px; font-weight: 500; color: var(--ct-heading); }

.hero { padding: 72px 0 56px; }
.hero--gradient { background: linear-gradient(150deg, color-mix(in srgb, var(--ct-primary) 12%, var(--ct-bg)), var(--ct-bg) 62%); }
.hero--solid { background: var(--ct-primary); color: var(--ct-primary-contrast); }
.hero--solid h1, .hero--solid .eyebrow, .hero--solid .lede, .hero--solid .stat .v, .hero--solid .stat .l { color: var(--ct-primary-contrast); }
.hero--solid .eyebrow, .hero--solid .lede, .hero--solid .stat .l { opacity: .8; }
.hero--bordered { border-bottom: 4px solid var(--ct-primary); }
.hero--minimal { border-bottom: 1px solid var(--ct-line); }
.stats { display: flex; flex-wrap: wrap; gap: 12px 34px; margin-top: 28px; }
.stat .v { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -.02em; }
.stat .l { font-size: 11.5px; color: var(--ct-muted); margin: 4px 0 0; }

main { padding: 48px 24px 72px; }
.card { background: var(--ct-surface); border: var(--ct-card-border); box-shadow: var(--ct-card-shadow); border-radius: var(--ct-radius); padding: 18px 20px; margin: 0 0 18px; }
.grid2 { display: grid; gap: 16px; grid-template-columns: 1fr; margin: 22px 0; }
@media (min-width: 640px) { .grid2 { grid-template-columns: 1fr 1fr; } }
.objectives h2 { font-size: 18px; margin-bottom: 10px; }

.toc { margin: 32px 0 44px; }
.toc ol { margin: 0; padding-left: 20px; }
.toc li { margin-bottom: 6px; display: flex; justify-content: space-between; gap: 16px; }
.toc li span { color: var(--ct-muted); font-size: 13px; white-space: nowrap; }

ul.dots, ol.numbered { margin: 0 0 14px; padding: 0; list-style: none; }
ul.dots li { position: relative; padding-left: 18px; margin-bottom: 8px; }
ul.dots li::before { content: ""; position: absolute; left: 2px; top: .72em; width: 5px; height: 5px; border-radius: 50%; background: var(--ct-primary); }
ol.numbered { counter-reset: n; }
ol.numbered li { counter-increment: n; position: relative; padding-left: 30px; margin-bottom: 9px; }
ol.numbered li::before { content: counter(n); position: absolute; left: 0; top: .1em; width: 21px; height: 21px; border-radius: 50%; background: var(--ct-accent-soft); color: var(--ct-primary); font-size: 11.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
ul.ticks { margin: 0; padding: 0; list-style: none; }
ul.ticks li { position: relative; padding-left: 20px; margin-bottom: 9px; }
ul.ticks li::before { content: "✓"; position: absolute; left: 0; color: var(--ct-accent); font-weight: 700; }

.module { margin: 56px 0; }
.module-head { border-top: 2px solid var(--ct-primary); padding-top: 20px; margin-bottom: 30px; }
.module-head h2 { margin-top: 6px; }
.lesson { margin: 0 0 44px; }
.lesson h3 { margin-top: 4px; }
.objstrip { background: var(--ct-surface-alt); border: 1px solid var(--ct-line); border-radius: var(--ct-radius); padding: 14px 16px; margin: 16px 0; }

.callout { border-left: 3px solid var(--ct-primary); background: var(--ct-accent-soft); border-radius: var(--ct-radius); padding: 14px 16px; margin: 18px 0; }
.callout p:last-child { margin: 0; }

.code { margin: 18px 0; }
.code > div.code-head { border: 1px solid var(--ct-line); border-bottom: 0; border-radius: var(--ct-radius) var(--ct-radius) 0 0; background: var(--ct-surface-alt); padding: 6px 14px; font-family: var(--ct-font-mono); font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--ct-muted); }
.code pre { margin: 0; border: 1px solid var(--ct-line); border-radius: 0 0 var(--ct-radius) var(--ct-radius); background: var(--ct-surface-alt); padding: 14px; overflow-x: auto; }
.code code { font-family: var(--ct-font-mono); font-size: 13px; line-height: 1.65; }
figcaption { font-size: 12.5px; color: var(--ct-muted); margin-top: 6px; }

.example { border: var(--ct-card-border); box-shadow: var(--ct-card-shadow); border-radius: var(--ct-radius); overflow: hidden; margin: 20px 0; background: var(--ct-surface); }
.example-head { background: var(--ct-surface-alt); border-bottom: 1px solid var(--ct-line); padding: 12px 18px; }
.example-head h4 { margin-top: 2px; }
.example-body { padding: 16px 18px; }
.outcome { border-top: 1px solid var(--ct-line); padding-top: 12px; margin-bottom: 0; }

.steps ol { list-style: none; counter-reset: s; margin: 12px 0 0; padding: 0; }
.steps li { counter-increment: s; position: relative; padding-left: 38px; margin-bottom: 14px; }
.steps li::before { content: counter(s); position: absolute; left: 0; top: 0; width: 25px; height: 25px; border-radius: 50%; background: var(--ct-primary); color: var(--ct-primary-contrast); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.steps li strong { display: block; color: var(--ct-heading); }
.steps li span { color: var(--ct-text); font-size: 15px; }

.table { margin: 20px 0; overflow-x: auto; }
.table table { width: 100%; border-collapse: collapse; border: 1px solid var(--ct-line); border-radius: var(--ct-radius); }
.table th { background: var(--ct-surface-alt); text-align: left; font-size: 13px; padding: 10px 14px; border-bottom: 1px solid var(--ct-line); }
.table td { padding: 10px 14px; font-size: 14.5px; border-bottom: 1px solid var(--ct-line); vertical-align: top; }
.table tr:last-child td { border-bottom: 0; }

.activity { border: 1px dashed color-mix(in srgb, var(--ct-primary) 45%, transparent); border-radius: var(--ct-radius); overflow: hidden; margin: 22px 0; }
.activity-head { display: flex; justify-content: space-between; align-items: center; background: var(--ct-accent-soft); padding: 10px 18px; }
.activity-head .label { margin: 0; }
.activity h4 { margin: 16px 18px 10px; }
.activity ol, .activity ul, .activity p { margin-left: 18px; margin-right: 18px; }
.activity > *:last-child { margin-bottom: 16px; }

.checks { margin: 22px 0; }
details { border: 1px solid var(--ct-line); border-radius: var(--ct-radius); padding: 12px 16px; margin-bottom: 8px; background: var(--ct-surface); }
details summary { cursor: pointer; font-size: 15px; color: var(--ct-text); }
details p { margin: 10px 0 0; color: var(--ct-text); font-size: 14.5px; }

.quiz { margin: 30px 0; }
.module-quiz { background: var(--ct-surface-alt); border-radius: var(--ct-radius); padding: 8px 22px 18px; }
ol.questions { list-style: none; margin: 16px 0 0; padding: 0; counter-reset: q; }
.question { counter-increment: q; background: var(--ct-surface); border: var(--ct-card-border); box-shadow: var(--ct-card-shadow); border-radius: var(--ct-radius); padding: 16px 18px; margin-bottom: 14px; }
.q-head { display: flex; gap: 12px; }
.q-head .num { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; background: var(--ct-accent-soft); color: var(--ct-primary); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.q-head .num::before { content: counter(q); }
.stem { font-weight: 500; color: var(--ct-heading); margin-bottom: 4px; }
.q-head p { margin-bottom: 0; }
ul.options { list-style: none; margin: 12px 0 0 36px; padding: 0; }
ul.options li { display: flex; gap: 10px; border: 1px solid var(--ct-line); border-radius: var(--ct-radius); padding: 8px 12px; margin-bottom: 6px; font-size: 14.5px; }
ul.options li.correct { border-color: var(--ct-accent); background: var(--ct-accent-soft); }
ul.options .key { flex: 0 0 auto; width: 18px; height: 18px; border: 1px solid var(--ct-line); border-radius: 50%; font-size: 10.5px; font-weight: 700; color: var(--ct-muted); display: flex; align-items: center; justify-content: center; margin-top: 2px; }
ul.options li.correct .key { background: var(--ct-accent); border-color: var(--ct-accent); color: #fff; }
.written { margin: 12px 0 0 36px; border: 1px dashed var(--ct-line); border-radius: var(--ct-radius); padding: 22px; color: var(--ct-muted); font-size: 13px; }
.why { margin: 12px 0 0 36px; border: 0; border-top: 1px solid var(--ct-line); border-radius: 0; padding: 10px 0 0; background: none; }
.why summary { font-size: 13px; color: var(--ct-primary); font-weight: 600; }
.why p { font-size: 13.5px; color: var(--ct-muted); }

.foot { border-top: 1px solid var(--ct-line); padding-top: 20px; margin-top: 56px; font-size: 12.5px; color: var(--ct-muted); }

@media print {
  body { background: #fff; }
  .module { break-before: page; }
  .question, .example, .activity, .card { break-inside: avoid; }
  details { open: true; }
  details > summary { list-style: none; }
  details p { display: block !important; }
}
`;
