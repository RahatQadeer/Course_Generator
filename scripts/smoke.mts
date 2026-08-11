/**
 * Offline smoke test: fixture → schema validation → structural quality check →
 * HTML export. Catches everything that does not need a live model.
 * Run with: npx tsx scripts/smoke.mts
 */
import { stubServerOnly } from "./stub-server-only.mts";

stubServerOnly();

const { writeFileSync } = await import("node:fs");

const { makeCourse } = await import("./fixture.mts");
const { courseToHtml } = await import("../src/lib/export/html");
const { structuralCheck } = await import("../src/services/ai/courseValidator");
const { countLessons, countQuestions, totalMinutes } = await import("../src/lib/schema/course");
const ops = await import("../src/lib/course-ops");

let failures = 0;
const check = (label: string, condition: boolean, detail = "") => {
  if (!condition) failures++;
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const course = makeCourse();
check("fixture parses against courseSchema", true);
check("lesson count", countLessons(course) === 1, String(countLessons(course)));
check("question count", countQuestions(course) === 4, String(countQuestions(course)));
check("total minutes", totalMinutes(course) === 18, String(totalMinutes(course)));

const structural = structuralCheck(course);
check("no structural issues", structural.issues.length === 0, structural.issues.map((i) => i.detail).join(" | "));
check("structural score is 100", structural.score === 100, String(structural.score));

// A deliberately broken course must be caught.
const broken = {
  ...course,
  modules: course.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => ({
      ...l,
      content: [],
      quiz: l.quiz
        ? { ...l.quiz, questions: [{ ...l.quiz.questions[0], type: "multiple-choice" as const, options: ["a"], correctOptionIndexes: [] }] }
        : null,
    })),
  })),
};
const brokenReport = structuralCheck(broken);
check("empty lesson detected", brokenReport.issues.some((i) => i.severity === "critical"));
check("bad question detected", brokenReport.issues.some((i) => i.area === "Assessment"));
check("broken course scores lower", brokenReport.score < structural.score, `${brokenReport.score} < ${structural.score}`);

// Course tree operations.
const added = ops.addLesson(course, "module_1");
check("addLesson appends", added.course.modules[0].lessons.length === 2);
const removed = ops.deleteLesson(added.course, added.lesson.id);
check("deleteLesson removes", removed.modules[0].lessons.length === 1);
const withModule = ops.addModule(course);
check("addModule appends", withModule.course.modules.length === 2);
const nodes = ops.courseNodes(course);
check("courseNodes covers overview + lesson + quiz + final", nodes.length === 4, nodes.map((n) => n.kind).join(","));

// HTML export.
for (const themeId of ["modern", "academic", "corporate", "minimal", "technology", "creative", "dark"]) {
  const html = courseToHtml({ ...course, themeId });
  const ok =
    html.startsWith("<!doctype html>") &&
    html.includes(course.title) &&
    html.includes("Fixing the Cut-Off") &&
    html.includes("Accrue and reverse") &&
    html.includes("Final Assessment") &&
    !html.includes("undefined") &&
    !html.includes("[object Object]");
  check(`html export (${themeId})`, ok, `${Math.round(html.length / 1024)}kb`);
  if (themeId === "modern") writeFileSync("/tmp/coursegen-export.html", html);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll smoke checks passed.");
process.exit(failures ? 1 : 0);
