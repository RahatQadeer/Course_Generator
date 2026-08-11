import type { Course, GenerationRequest } from "@/lib/schema/course";
import type { Blueprint } from "@/services/ai/coursePlanner";

/**
 * Regeneration and editing happen long after the original brief is gone —
 * the course itself is the source of truth. These rebuild just enough context
 * for the generation services to run again coherently.
 */

export function requestFromCourse(course: Course, overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    topic: course.meta.topic || course.title,
    title: course.title,
    description: course.description,
    audience: course.audience,
    difficulty: course.difficulty,
    duration: course.duration,
    moduleCount: Math.max(1, course.modules.length),
    language: course.meta.language || "English",
    teachingStyle: course.meta.teachingStyle,
    sources: [],
    depth: "standard",
    includeQuizzes: true,
    includeFinalAssessment: true,
    ...overrides,
  };
}

export function blueprintFromCourse(course: Course): Blueprint {
  return {
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    audience: course.audience,
    difficulty: course.difficulty,
    prerequisites: course.prerequisites,
    estimatedHours: course.estimatedHours || 1,
    domainAnalysis: [
      `Course objectives: ${course.learningObjectives.join("; ")}`,
      `Module sequence: ${course.modules.map((module, index) => `${index + 1}. ${module.title}`).join(" → ")}`,
      course.meta.sourceSummary ? `Source material: ${course.meta.sourceSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    inScope: course.modules.map((module) => module.title),
    outOfScope: [],
    sourceUsage: "",
    sourceSummary: course.meta.sourceSummary ?? "",
  };
}
