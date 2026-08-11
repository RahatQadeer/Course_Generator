"use client";

import { CourseDocument } from "@/components/course/course-document";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/primitives";
import { downloadCourseHtml, downloadCourseJson } from "@/lib/export";
import { useCourseStore } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { THEMES } from "@/lib/themes";
import { ArrowLeft, Download, FileJson, FileText, Loader2, Palette, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

export function PreviewView({ courseId }: { courseId: string }) {
  const record = useCourseStore((state) => state.courses[courseId]);
  const mutate = useCourseStore((state) => state.mutate);
  const hydrated = useHydrated();
  const params = useSearchParams();
  const autoPrint = params.get("print") === "1";

  const course = record?.course;

  /* Opened from "Export as PDF" — render, then hand off to the print dialog. */
  React.useEffect(() => {
    if (!autoPrint || !course) return;
    const timer = setTimeout(() => window.print(), 900);
    return () => clearTimeout(timer);
  }, [autoPrint, course]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--ink-faint)]" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <EmptyState
          icon={<FileText />}
          title="Course not found"
          description="Courses live in this browser's storage."
          action={
            <Button variant="primary" size="sm" asChild>
              <Link href="/">Back to CourseGen</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)]/90 px-4 backdrop-blur-md sm:px-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/course/${courseId}`}>
            <ArrowLeft />
            Back to editor
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-center text-[13px] text-[var(--ink-faint)]">
            Preview — this is exactly how the course looks when exported
          </p>
        </div>
        <Menu
          width={188}
          trigger={
            <Button variant="ghost" size="sm">
              <Palette />
              <span className="hidden sm:inline">Theme</span>
            </Button>
          }
        >
          <MenuLabel>Theme</MenuLabel>
          {THEMES.map((theme) => (
            <MenuItem
              key={theme.id}
              onSelect={() =>
                mutate(courseId, (current) => ({ ...current, themeId: theme.id, updatedAt: new Date().toISOString() }))
              }
            >
              {theme.name}
              {course.themeId === theme.id ? " ✓" : ""}
            </MenuItem>
          ))}
        </Menu>
        <Menu
          width={208}
          trigger={
            <Button variant="secondary" size="sm">
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
          }
        >
          <MenuItem icon={<Printer />} onSelect={() => window.print()}>
            Export as PDF
          </MenuItem>
          <MenuItem
            icon={<FileText />}
            onSelect={() => {
              downloadCourseHtml(course, record.themeOverrides);
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
      </div>

      <CourseDocument course={course} overrides={record.themeOverrides} />
    </div>
  );
}
