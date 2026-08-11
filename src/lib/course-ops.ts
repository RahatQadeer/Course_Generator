import type { Course, Lesson, Module, Quiz } from "@/lib/schema/course";
import { id } from "@/lib/utils";

/** Pure, immutable operations over the course tree. */

export function touch(course: Course): Course {
  return { ...course, updatedAt: new Date().toISOString() };
}

export function updateCourse(course: Course, patch: Partial<Course>): Course {
  return touch({ ...course, ...patch });
}

export function mapModules(course: Course, fn: (module: Module) => Module): Course {
  return touch({ ...course, modules: course.modules.map(fn) });
}

export function updateModule(course: Course, moduleId: string, patch: Partial<Module>): Course {
  return mapModules(course, (module) => (module.id === moduleId ? { ...module, ...patch } : module));
}

export function replaceModule(course: Course, moduleId: string, next: Module): Course {
  return mapModules(course, (module) => (module.id === moduleId ? next : module));
}

export function updateLesson(course: Course, lessonId: string, patch: Partial<Lesson>): Course {
  return mapModules(course, (module) => ({
    ...module,
    lessons: module.lessons.map((lesson) =>
      lesson.id === lessonId ? { ...lesson, ...patch } : lesson,
    ),
  }));
}

export function replaceLesson(course: Course, lessonId: string, next: Lesson): Course {
  return updateLesson(course, lessonId, next);
}

export function deleteLesson(course: Course, lessonId: string): Course {
  return mapModules(course, (module) => ({
    ...module,
    lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
  }));
}

export function deleteModule(course: Course, moduleId: string): Course {
  return touch({ ...course, modules: course.modules.filter((module) => module.id !== moduleId) });
}

export function blankLesson(title = "Untitled lesson", difficulty: Course["difficulty"] = "beginner"): Lesson {
  return {
    id: id("lesson"),
    title,
    summary: "",
    durationMinutes: 15,
    difficulty,
    learningObjectives: [],
    introduction: "",
    content: [],
    activities: [],
    keyTakeaways: [],
    knowledgeChecks: [],
    quiz: null,
    outline: [],
    status: "planned",
  };
}

export function blankModule(title = "Untitled module"): Module {
  return {
    id: id("module"),
    title,
    description: "",
    learningObjectives: [],
    lessons: [],
    quiz: null,
  };
}

export function addLesson(course: Course, moduleId: string, afterLessonId?: string): { course: Course; lesson: Lesson } {
  const lesson = blankLesson("New lesson", course.difficulty);
  const next = mapModules(course, (module) => {
    if (module.id !== moduleId) return module;
    const lessons = [...module.lessons];
    const index = afterLessonId ? lessons.findIndex((l) => l.id === afterLessonId) : -1;
    if (index >= 0) lessons.splice(index + 1, 0, lesson);
    else lessons.push(lesson);
    return { ...module, lessons };
  });
  return { course: next, lesson };
}

export function addModule(course: Course, afterModuleId?: string): { course: Course; module: Module } {
  const module = blankModule(`Module ${course.modules.length + 1}`);
  const modules = [...course.modules];
  const index = afterModuleId ? modules.findIndex((m) => m.id === afterModuleId) : -1;
  if (index >= 0) modules.splice(index + 1, 0, module);
  else modules.push(module);
  return { course: touch({ ...course, modules }), module };
}

export function moveLesson(course: Course, lessonId: string, direction: -1 | 1): Course {
  return mapModules(course, (module) => {
    const index = module.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index === -1) return module;
    const target = index + direction;
    if (target < 0 || target >= module.lessons.length) return module;
    const lessons = [...module.lessons];
    [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
    return { ...module, lessons };
  });
}

export function moveModule(course: Course, moduleId: string, direction: -1 | 1): Course {
  const index = course.modules.findIndex((module) => module.id === moduleId);
  if (index === -1) return course;
  const target = index + direction;
  if (target < 0 || target >= course.modules.length) return course;
  const modules = [...course.modules];
  [modules[index], modules[target]] = [modules[target], modules[index]];
  return touch({ ...course, modules });
}

export function setModuleQuiz(course: Course, moduleId: string, quiz: Quiz | null): Course {
  return updateModule(course, moduleId, { quiz });
}

export function setLessonQuiz(course: Course, lessonId: string, quiz: Quiz | null): Course {
  return updateLesson(course, lessonId, { quiz });
}

export function moduleOfLesson(course: Course, lessonId: string): Module | undefined {
  return course.modules.find((module) => module.lessons.some((lesson) => lesson.id === lessonId));
}

/** Every node in reading order — used for prev/next navigation. */
export type CourseNode =
  | { kind: "overview" }
  | { kind: "lesson"; moduleId: string; lessonId: string }
  | { kind: "module-quiz"; moduleId: string }
  | { kind: "final" };

export function courseNodes(course: Course): CourseNode[] {
  const nodes: CourseNode[] = [{ kind: "overview" }];
  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      nodes.push({ kind: "lesson", moduleId: module.id, lessonId: lesson.id });
    }
    if (module.quiz) nodes.push({ kind: "module-quiz", moduleId: module.id });
  }
  if (course.finalAssessment) nodes.push({ kind: "final" });
  return nodes;
}

export function nodeKey(node: CourseNode): string {
  switch (node.kind) {
    case "overview":
      return "overview";
    case "lesson":
      return `lesson:${node.lessonId}`;
    case "module-quiz":
      return `quiz:${node.moduleId}`;
    case "final":
      return "final";
  }
}
