"use client";

import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import type { CourseNode } from "@/lib/course-ops";
import { nodeKey } from "@/lib/course-ops";
import type { Course } from "@/lib/schema/course";
import { cn, formatMinutes } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import * as React from "react";

export type SidebarActions = {
  addLesson: (moduleId: string) => void;
  generateLesson: (moduleId: string) => void;
  deleteLesson: (lessonId: string) => void;
  moveLesson: (lessonId: string, direction: -1 | 1) => void;
  regenerateLesson: (lessonId: string) => void;
  addModule: (afterModuleId?: string) => void;
  deleteModule: (moduleId: string) => void;
  moveModule: (moduleId: string, direction: -1 | 1) => void;
  regenerateModule: (moduleId: string) => void;
  regenerateModuleQuiz: (moduleId: string) => void;
  regenerateFinalAssessment: () => void;
};

export function Sidebar({
  course,
  selected,
  onSelect,
  actions,
  busyKey,
  disabled,
}: {
  course: Course;
  selected: CourseNode;
  onSelect: (node: CourseNode) => void;
  actions: SidebarActions;
  busyKey?: string;
  disabled?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const selectedKey = nodeKey(selected);

  const toggle = (moduleId: string) =>
    setCollapsed((current) => ({ ...current, [moduleId]: !current[moduleId] }));

  return (
    <nav className="scroll-thin flex h-full flex-col overflow-y-auto px-2 py-3">
      <Row
        icon={<BookOpen />}
        label="Course overview"
        active={selectedKey === "overview"}
        onClick={() => onSelect({ kind: "overview" })}
      />

      <div className="mt-3 space-y-0.5">
        {course.modules.map((module, moduleIndex) => {
          const isCollapsed = collapsed[module.id];
          const minutes = module.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
          const busy = busyKey === `module:${module.id}`;

          return (
            <div key={module.id}>
              <div className="group/module flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => toggle(module.id)}
                  className="focus-ring flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--radius)] px-1.5 py-1.5 text-left transition-colors hover:bg-black/[0.035]"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 text-[var(--ink-faint)] transition-transform",
                      !isCollapsed && "rotate-90",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold tracking-[-0.005em] text-[var(--ink)]">
                      {moduleIndex + 1}. {module.title}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--ink-faint)]">
                      {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                      {minutes ? ` · ${formatMinutes(minutes)}` : ""}
                    </span>
                  </span>
                  {busy && <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--brand)]" />}
                </button>

                <Menu
                  width={216}
                  trigger={
                    <Button
                      variant="ghost"
                      size="iconSm"
                      disabled={disabled}
                      className="shrink-0 opacity-0 group-hover/module:opacity-100 focus-visible:opacity-100"
                      aria-label={`Options for ${module.title}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  }
                >
                  <MenuLabel>Module {moduleIndex + 1}</MenuLabel>
                  <MenuItem icon={<Plus />} onSelect={() => actions.addLesson(module.id)}>
                    Add empty lesson
                  </MenuItem>
                  <MenuItem icon={<Sparkles />} onSelect={() => actions.generateLesson(module.id)}>
                    Generate a lesson
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<RefreshCw />} onSelect={() => actions.regenerateModule(module.id)}>
                    Regenerate module
                  </MenuItem>
                  <MenuItem
                    icon={<ListChecks />}
                    onSelect={() => actions.regenerateModuleQuiz(module.id)}
                  >
                    {module.quiz ? "Regenerate module quiz" : "Generate module quiz"}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    icon={<ArrowUp />}
                    disabled={moduleIndex === 0}
                    onSelect={() => actions.moveModule(module.id, -1)}
                  >
                    Move up
                  </MenuItem>
                  <MenuItem
                    icon={<ArrowDown />}
                    disabled={moduleIndex === course.modules.length - 1}
                    onSelect={() => actions.moveModule(module.id, 1)}
                  >
                    Move down
                  </MenuItem>
                  <MenuItem icon={<Plus />} onSelect={() => actions.addModule(module.id)}>
                    Add module below
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 />} danger onSelect={() => actions.deleteModule(module.id)}>
                    Delete module
                  </MenuItem>
                </Menu>
              </div>

              {!isCollapsed && (
                <div className="mt-0.5 ml-3 space-y-0.5 border-l border-[var(--line)] pl-1.5">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <Row
                      key={lesson.id}
                      icon={
                        lesson.status === "failed" ? (
                          <TriangleAlert className="text-[var(--danger)]" />
                        ) : (
                          <FileText />
                        )
                      }
                      label={lesson.title}
                      meta={formatMinutes(lesson.durationMinutes)}
                      active={selectedKey === `lesson:${lesson.id}`}
                      busy={busyKey === `lesson:${lesson.id}`}
                      dim={!lesson.content.length}
                      onClick={() =>
                        onSelect({ kind: "lesson", moduleId: module.id, lessonId: lesson.id })
                      }
                      menu={
                        <>
                          <MenuLabel>Lesson {lessonIndex + 1}</MenuLabel>
                          <MenuItem
                            icon={<RefreshCw />}
                            onSelect={() => actions.regenerateLesson(lesson.id)}
                          >
                            Regenerate lesson
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            icon={<ArrowUp />}
                            disabled={lessonIndex === 0}
                            onSelect={() => actions.moveLesson(lesson.id, -1)}
                          >
                            Move up
                          </MenuItem>
                          <MenuItem
                            icon={<ArrowDown />}
                            disabled={lessonIndex === module.lessons.length - 1}
                            onSelect={() => actions.moveLesson(lesson.id, 1)}
                          >
                            Move down
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            icon={<Trash2 />}
                            danger
                            onSelect={() => actions.deleteLesson(lesson.id)}
                          >
                            Delete lesson
                          </MenuItem>
                        </>
                      }
                      disabled={disabled}
                    />
                  ))}

                  {module.quiz && (
                    <Row
                      icon={<ListChecks />}
                      label={`Module quiz`}
                      meta={`${module.quiz.questions.length} q`}
                      active={selectedKey === `quiz:${module.id}`}
                      onClick={() => onSelect({ kind: "module-quiz", moduleId: module.id })}
                    />
                  )}

                  {!module.lessons.length && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => actions.generateLesson(module.id)}
                      className="focus-ring flex w-full items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-[12px] text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)] disabled:opacity-50"
                    >
                      <Sparkles className="size-3.5" />
                      Generate a lesson
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {course.finalAssessment && (
        <div className="mt-3">
          <Row
            icon={<GraduationCap />}
            label="Final assessment"
            meta={`${course.finalAssessment.questions.length} q`}
            active={selectedKey === "final"}
            busy={busyKey === "final"}
            onClick={() => onSelect({ kind: "final" })}
            menu={
              <MenuItem icon={<RefreshCw />} onSelect={actions.regenerateFinalAssessment}>
                Regenerate assessment
              </MenuItem>
            }
            disabled={disabled}
          />
        </div>
      )}

      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          disabled={disabled}
          onClick={() => actions.addModule()}
        >
          <Plus />
          Add module
        </Button>
        {!course.finalAssessment && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={disabled}
            onClick={actions.regenerateFinalAssessment}
          >
            <GraduationCap />
            Generate final assessment
          </Button>
        )}
      </div>
    </nav>
  );
}

function Row({
  icon,
  label,
  meta,
  active,
  busy,
  dim,
  onClick,
  menu,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  meta?: string;
  active?: boolean;
  busy?: boolean;
  dim?: boolean;
  onClick: () => void;
  menu?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="group/row flex items-center gap-0.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-left transition-colors",
          active
            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
            : "text-[var(--ink-soft)] hover:bg-black/[0.035] hover:text-[var(--ink)]",
        )}
      >
        <span
          className={cn(
            "shrink-0 [&_svg]:size-3.5",
            active ? "text-[var(--brand)]" : "text-[var(--ink-faint)]",
          )}
        >
          {busy ? <Loader2 className="animate-spin text-[var(--brand)]" /> : icon}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12.5px]",
            active && "font-medium",
            dim && !active && "text-[var(--ink-faint)] italic",
          )}
        >
          {label}
        </span>
        {meta && (
          <span className="shrink-0 text-[10.5px] text-[var(--ink-faint)] tabular-nums">{meta}</span>
        )}
      </button>
      {menu && (
        <Menu
          width={208}
          trigger={
            <Button
              variant="ghost"
              size="iconSm"
              disabled={disabled}
              className="shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
              aria-label={`Options for ${label}`}
            >
              <MoreHorizontal />
            </Button>
          }
        >
          {menu}
        </Menu>
      )}
    </div>
  );
}
