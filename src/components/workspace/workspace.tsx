"use client";

import { TopBar, Wordmark } from "@/components/app-shell";
import { QuizView } from "@/components/course/quiz-view";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { EmptyState, Progress } from "@/components/ui/primitives";
import { Inspector } from "@/components/workspace/inspector";
import { LessonPane } from "@/components/workspace/lesson-pane";
import { OverviewPane } from "@/components/workspace/overview-pane";
import { Sidebar, type SidebarActions } from "@/components/workspace/sidebar";
import { ThemePanel } from "@/components/workspace/theme-panel";
import { courseNodes, nodeKey, type CourseNode } from "@/lib/course-ops";
import { downloadCourseHtml, downloadCourseJson, printCourse } from "@/lib/export";
import type { Course, Lesson } from "@/lib/schema/course";
import { ops, useCourseStore } from "@/lib/store";
import { getTheme, themeStyle } from "@/lib/themes";
import { useAIAction } from "@/lib/use-ai-action";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, relativeTime } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  Eye,
  FileJson,
  FileText,
  Loader2,
  Menu as MenuIcon,
  Palette,
  Printer,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

export function Workspace({ courseId }: { courseId: string }) {
  const record = useCourseStore((state) => state.courses[courseId]);
  const mutate = useCourseStore((state) => state.mutate);
  const setThemeOverrides = useCourseStore((state) => state.setThemeOverrides);
  const hydrated = useHydrated();

  const { job, run, cancel, busy } = useAIAction(courseId);
  const [requested, setSelected] = React.useState<CourseNode>({ kind: "overview" });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<{ title: string; description: string; run: () => void } | null>(null);
  const [lessonHint, setLessonHint] = React.useState<{ moduleId: string } | null>(null);
  const [hint, setHint] = React.useState("");

  const course = record?.course;
  const themeOverrides = record?.themeOverrides ?? {};

  /* ---------------------------------------------------------------- */

  const patchCourse = React.useCallback(
    (patch: Partial<Course>) => mutate(courseId, (current) => ops.updateCourse(current, patch)),
    [courseId, mutate],
  );

  const patchLesson = React.useCallback(
    (lessonId: string, patch: Partial<Lesson>) =>
      mutate(courseId, (current) => ops.updateLesson(current, lessonId, patch)),
    [courseId, mutate],
  );

  /**
   * Deleting or regenerating can remove whatever is on screen. Rather than
   * correcting the selection in an effect (which flashes a broken frame), the
   * selection is resolved during render and falls back to the overview.
   */
  const resolved = React.useMemo(() => {
    const overview = { node: { kind: "overview" } as CourseNode, located: null };
    if (!course) return overview;

    if (requested.kind === "lesson") {
      const module = course.modules.find((entry) => entry.id === requested.moduleId);
      const lesson = module?.lessons.find((entry) => entry.id === requested.lessonId);
      return module && lesson ? { node: requested, located: { module, lesson } } : overview;
    }
    if (requested.kind === "module-quiz") {
      const module = course.modules.find((entry) => entry.id === requested.moduleId);
      return module?.quiz
        ? { node: requested, located: { module, lesson: undefined } }
        : overview;
    }
    if (requested.kind === "final") {
      return course.finalAssessment ? { node: requested, located: null } : overview;
    }
    return overview;
  }, [course, requested]);

  const selected = resolved.node;
  const located = resolved.located;

  const nodes = React.useMemo(() => (course ? courseNodes(course) : []), [course]);
  const position = nodes.findIndex((node) => nodeKey(node) === nodeKey(selected));

  /* ---------------------------------------------------------------- */

  const actions: SidebarActions = React.useMemo(
    () => ({
      addLesson: (moduleId) =>
        mutate(courseId, (current) => {
          const { course: next, lesson } = ops.addLesson(current, moduleId);
          setSelected({ kind: "lesson", moduleId, lessonId: lesson.id });
          return next;
        }),

      generateLesson: (moduleId) => {
        setLessonHint({ moduleId });
        setHint("");
      },

      deleteLesson: (lessonId) => {
        const lesson = course?.modules.flatMap((module) => module.lessons).find((entry) => entry.id === lessonId);
        setConfirm({
          title: "Delete this lesson?",
          description: `“${lesson?.title ?? "This lesson"}” and its quiz will be removed.`,
          run: () => mutate(courseId, (current) => ops.deleteLesson(current, lessonId)),
        });
      },

      moveLesson: (lessonId, direction) =>
        mutate(courseId, (current) => ops.moveLesson(current, lessonId, direction)),

      regenerateLesson: (lessonId) => {
        if (!course) return;
        void run(course, { action: "regenerate-lesson", lessonId }, {
          key: `lesson:${lessonId}`,
          label: "Regenerating lesson",
          success: "Lesson regenerated",
        });
      },

      addModule: (afterModuleId) =>
        mutate(courseId, (current) => {
          const { course: next } = ops.addModule(current, afterModuleId);
          return next;
        }),

      deleteModule: (moduleId) => {
        const module = course?.modules.find((entry) => entry.id === moduleId);
        setConfirm({
          title: "Delete this module?",
          description: `“${module?.title ?? "This module"}” and its ${module?.lessons.length ?? 0} lesson(s) will be removed.`,
          run: () => mutate(courseId, (current) => ops.deleteModule(current, moduleId)),
        });
      },

      moveModule: (moduleId, direction) =>
        mutate(courseId, (current) => ops.moveModule(current, moduleId, direction)),

      regenerateModule: (moduleId) => {
        if (!course) return;
        const module = course.modules.find((entry) => entry.id === moduleId);
        setConfirm({
          title: "Regenerate this module?",
          description: `Every lesson in “${module?.title ?? "this module"}” will be rewritten from scratch. Any edits you made will be lost.`,
          run: () =>
            void run(course, { action: "regenerate-module", moduleId }, {
              key: `module:${moduleId}`,
              label: "Regenerating module",
              success: "Module regenerated",
            }),
        });
      },

      regenerateModuleQuiz: (moduleId) => {
        if (!course) return;
        void run(course, { action: "regenerate-module-quiz", moduleId }, {
          key: `module:${moduleId}`,
          label: "Building module quiz",
          success: "Module quiz ready",
        });
      },

      regenerateFinalAssessment: () => {
        if (!course) return;
        void run(course, { action: "regenerate-final-assessment" }, {
          key: "final",
          label: "Composing final assessment",
          success: "Final assessment ready",
        });
      },
    }),
    [course, courseId, mutate, run],
  );

  /* ---------------------------------------------------------------- */

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--ink-faint)]" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<FileText />}
            title="Course not found"
            description="Courses are stored in this browser. It may have been deleted, or created somewhere else."
            action={
              <Button variant="primary" size="sm" asChild>
                <Link href="/">Create a course</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const theme = getTheme(course.themeId);
  const themeVars = themeStyle(theme, themeOverrides);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        left={
          <>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open course structure"
            >
              <MenuIcon />
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Back to courses">
              <Link href="/">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[13.5px] font-medium tracking-[-0.01em] text-[var(--ink)]">
                {course.title}
              </p>
              <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-faint)]">
                <Cloud className="size-3" />
                Saved {relativeTime(record.savedAt)}
              </p>
            </div>
          </>
        }
        right={
          <>
            {busy && (
              <Button variant="ghost" size="sm" onClick={cancel}>
                <X />
                Cancel
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setThemeOpen(true)}>
              <Palette />
              <span className="hidden sm:inline">Theme</span>
            </Button>
            <Menu
              width={216}
              trigger={
                <Button variant="ghost" size="sm">
                  <Download />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              }
            >
              <MenuLabel>Export</MenuLabel>
              <MenuItem
                icon={<Printer />}
                onSelect={() => {
                  printCourse(course.id);
                  toast.info("Opening the print dialog", {
                    description: "Choose “Save as PDF” as the destination.",
                  });
                }}
              >
                Export as PDF
              </MenuItem>
              <MenuItem
                icon={<FileText />}
                onSelect={() => {
                  downloadCourseHtml(course, themeOverrides);
                  toast.success("HTML downloaded");
                }}
              >
                Export as HTML
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<FileJson />}
                onSelect={() => {
                  downloadCourseJson(course);
                  toast.success("Course JSON downloaded");
                }}
              >
                Download course JSON
              </MenuItem>
            </Menu>
            <Button variant="primary" size="sm" asChild>
              <Link href={`/course/${course.id}/preview`}>
                <Eye />
                Preview
              </Link>
            </Button>
          </>
        }
      />

      {job && (
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--brand-soft)] px-4 py-2">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--brand)]" />
          <span className="shrink-0 text-[12.5px] font-medium text-[var(--brand)]">{job.label}</span>
          {job.detail && (
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-soft)]">
              {job.detail}
            </span>
          )}
          {job.progress !== undefined && (
            <Progress value={job.progress * 100} className="h-1 w-32 shrink-0" />
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Sidebar --------------------------------------------------- */}
        <div className="hidden w-[268px] shrink-0 border-r border-[var(--line)] bg-[var(--surface)] lg:block">
          <Sidebar
            course={course}
            selected={selected}
            onSelect={setSelected}
            actions={actions}
            busyKey={job?.key}
            disabled={busy}
          />
        </div>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
            <div className="animate-fade-in absolute inset-y-0 left-0 w-[280px] border-r border-[var(--line)] bg-[var(--surface)]">
              <div className="flex h-14 items-center justify-between border-b border-[var(--line)] px-3">
                <Wordmark />
                <Button variant="ghost" size="iconSm" onClick={() => setSidebarOpen(false)} aria-label="Close">
                  <X />
                </Button>
              </div>
              <div className="h-[calc(100%-3.5rem)]">
                <Sidebar
                  course={course}
                  selected={selected}
                  onSelect={(node) => {
                    setSelected(node);
                    setSidebarOpen(false);
                  }}
                  actions={actions}
                  busyKey={job?.key}
                  disabled={busy}
                />
              </div>
            </div>
          </div>
        )}

        {/* Center ---------------------------------------------------- */}
        <main className="scroll-thin min-w-0 flex-1 overflow-y-auto bg-[var(--canvas)]">
          {selected.kind === "overview" && (
            <OverviewPane
              course={course}
              onPatch={patchCourse}
              busy={busy}
              onQualityCheck={() =>
                void run(course, { action: "quality-check" }, {
                  key: "course",
                  label: "Reviewing the course",
                  success: "Quality check complete",
                })
              }
              onImproveCopy={(instruction) =>
                void run(course, { action: "improve-course-copy", instruction }, {
                  key: "course",
                  label: "Rewriting the overview",
                  success: "Overview updated",
                })
              }
            />
          )}

          {selected.kind === "lesson" && located?.lesson && (
            <LessonPane
              key={located.lesson.id}
              lesson={located.lesson}
              module={located.module}
              moduleIndex={course.modules.indexOf(located.module)}
              lessonIndex={located.module.lessons.indexOf(located.lesson)}
              busy={busy}
              onPatch={(patch) => patchLesson(located.lesson!.id, patch)}
              onRegenerate={() => actions.regenerateLesson(located.lesson!.id)}
              onRegenerateQuiz={() =>
                void run(course, { action: "regenerate-lesson-quiz", lessonId: located.lesson!.id }, {
                  key: `lesson:${located.lesson!.id}`,
                  label: "Writing quiz questions",
                  success: "Quiz ready",
                })
              }
              onImprove={(improve) =>
                void run(course, { action: "improve-lesson", lessonId: located.lesson!.id, improve }, {
                  key: `lesson:${located.lesson!.id}`,
                  label: "Improving the lesson",
                  success: "Lesson improved",
                })
              }
            />
          )}

          {selected.kind === "module-quiz" && located?.module.quiz && (
            <div className="course-theme mx-auto w-full max-w-3xl px-5 py-8 sm:px-8" style={themeVars}>
              <QuizView quiz={located.module.quiz} defaultRevealed />
            </div>
          )}

          {selected.kind === "final" && course.finalAssessment && (
            <div className="course-theme mx-auto w-full max-w-3xl px-5 py-8 sm:px-8" style={themeVars}>
              <QuizView quiz={course.finalAssessment} defaultRevealed />
            </div>
          )}

          {/* Prev / next ---------------------------------------------- */}
          {position >= 0 && (
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 pb-10 sm:px-8">
              <Button
                variant="secondary"
                size="sm"
                disabled={position <= 0}
                onClick={() => setSelected(nodes[position - 1])}
              >
                <ChevronLeft />
                Previous
              </Button>
              <span className="text-[12px] text-[var(--ink-faint)] tabular-nums">
                {position + 1} / {nodes.length}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={position >= nodes.length - 1}
                onClick={() => setSelected(nodes[position + 1])}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          )}
        </main>

        {/* Inspector ------------------------------------------------- */}
        <div className="hidden w-[264px] shrink-0 border-l border-[var(--line)] bg-[var(--surface)] xl:block">
          <Inspector
            course={course}
            node={selected}
            lesson={located?.lesson}
            module={located?.module}
          />
        </div>
      </div>

      {/* Dialogs ----------------------------------------------------- */}
      <ThemePanel
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        course={course}
        overrides={themeOverrides}
        onThemeChange={(themeId) => patchCourse({ themeId })}
        onOverridesChange={(next) => setThemeOverrides(courseId, next)}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.title.startsWith("Regenerate") ? "Regenerate" : "Delete"}
        destructive={!confirm?.title.startsWith("Regenerate")}
      />

      <Dialog
        open={Boolean(lessonHint)}
        onClose={() => setLessonHint(null)}
        title="Generate a lesson"
        description="The AI plans and writes a lesson that fits this module without repeating what is already there."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setLessonHint(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const moduleId = lessonHint?.moduleId;
                setLessonHint(null);
                if (moduleId) {
                  void run(course, { action: "generate-lesson", moduleId, hint }, {
                    key: `module:${moduleId}`,
                    label: "Writing a new lesson",
                    success: "Lesson added",
                  });
                }
              }}
            >
              <Sparkles />
              Generate
            </Button>
          </>
        }
      >
        <Textarea
          autoFocus
          rows={3}
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          placeholder="Optional — what should this lesson cover? Leave blank and the AI fills the biggest gap."
        />
      </Dialog>

      <span className={cn("sr-only", busy && "animate-pulse")}>
        {busy ? "Working" : <Check className="size-3" />}
      </span>
    </div>
  );
}
