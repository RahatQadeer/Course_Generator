/**
 * Checks that every AI schema converts into something both providers accept:
 * an object at the root, no constructs Gemini rejects, and — the one that bit
 * us in production — no item-count bounds on arrays of complex objects, which
 * make Gemini reject the whole request with "invalid argument".
 *
 * Run with: npm run check:schemas
 */
import { stubServerOnly } from "./stub-server-only.mts";

stubServerOnly();

const { z } = await import("zod");
const { toGeminiSchema } = await import("../src/lib/ai/providers/gemini-schema");
const { blueprintSchema, objectivesSchema } = await import("../src/services/ai/coursePlanner");
const { lessonPlanListSchema, modulePlanListSchema } = await import(
  "../src/services/ai/curriculumGenerator"
);
const { activityBatchSchema, lessonBodySchema } = await import("../src/services/ai/lessonGenerator");
const { finalAssessmentSchema } = await import("../src/services/ai/assessmentGenerator");
const { lessonQuizBatchSchema, moduleQuizSchema } = await import("../src/services/ai/quizGenerator");
const { courseCopySchema, lessonSketchSchema } = await import("../src/services/ai/aiEditor");
const { reviewSchema } = await import("../src/services/ai/courseValidator");
const { courseSchema } = await import("../src/lib/schema/course");

const schemas = {
  blueprintSchema,
  objectivesSchema,
  modulePlanListSchema,
  lessonPlanListSchema,
  lessonBodySchema,
  activityBatchSchema,
  lessonQuizBatchSchema,
  moduleQuizSchema,
  finalAssessmentSchema,
  reviewSchema,
  courseCopySchema,
  lessonSketchSchema,
  courseSchema,
};

type Json = Record<string, unknown>;

/** Paths of arrays that still carry a count bound around object items. */
function boundedObjectArrays(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((entry, index) => boundedObjectArrays(entry, `${path}[${index}]`));
  }
  if (!node || typeof node !== "object") return [];

  const schema = node as Json;
  const found: string[] = [];

  if (
    schema.type === "array" &&
    (schema.minItems !== undefined || schema.maxItems !== undefined) &&
    isObjectish(schema.items)
  ) {
    found.push(path);
  }

  for (const [key, value] of Object.entries(schema)) {
    found.push(...boundedObjectArrays(value, `${path}.${key}`));
  }
  return found;
}

function isObjectish(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const schema = node as Json;
  if (schema.type === "object" || schema.properties) return true;
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const branches = schema[key];
    if (Array.isArray(branches) && branches.some(isObjectish)) return true;
  }
  if (schema.type === "array") return isObjectish(schema.items);
  return false;
}

let failures = 0;

for (const [name, schema] of Object.entries(schemas)) {
  try {
    const json = z.toJSONSchema(schema as never, {
      io: "input",
      unrepresentable: "any",
    }) as Json;
    const gemini = toGeminiSchema(json);
    const serialised = JSON.stringify(gemini);

    const problems: string[] = [];
    if (json.type !== "object") problems.push("root is not an object");
    if (gemini.type !== "object") problems.push("gemini root is not an object");
    for (const keyword of ["$ref", "$defs", "const", "additionalProperties"]) {
      if (serialised.includes(`"${keyword}"`)) problems.push(`leaks ${keyword}`);
    }
    const bounded = boundedObjectArrays(gemini);
    if (bounded.length) problems.push(`min/maxItems on object arrays: ${bounded.join(", ")}`);

    if (problems.length) failures++;
    console.log(
      `${problems.length ? "FAIL" : "ok  "} ${name.padEnd(24)} anthropic=${JSON.stringify(json).length}b gemini=${serialised.length}b` +
        (problems.length ? `\n     ${problems.join("\n     ")}` : ""),
    );
  } catch (error) {
    failures++;
    console.log(`FAIL ${name}: ${(error as Error).message}`);
  }
}

console.log(failures ? `\n${failures} schema(s) failed` : "\nAll schemas convert cleanly.");
process.exit(failures ? 1 : 0);
