"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Badge, Card, SectionLabel } from "@/components/ui/primitives";
import { DIFFICULTY_LABEL, countLessons } from "@/lib/schema/course";
import { useCourseList, useCourseStore } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { pluralize, relativeTime } from "@/lib/utils";
import { MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export function RecentCourses() {
  const records = useCourseList();
  const removeCourse = useCourseStore((state) => state.removeCourse);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const hydrated = useHydrated();

  if (!hydrated || !records.length) return null;

  const target = records.find((record) => record.course.id === pendingDelete);

  return (
    <section id="library" className="mx-auto w-full max-w-4xl">
      <SectionLabel className="mb-3">Your courses</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {records.map(({ course, savedAt }) => (
          <Card key={course.id} className="group relative transition-shadow hover:shadow-[0_2px_4px_rgb(16_24_40/0.06),0_16px_32px_-20px_rgb(16_24_40/0.3)]">
            <Link href={`/course/${course.id}`} className="focus-ring block rounded-[inherit] p-4">
              <p className="line-clamp-2 pr-7 text-[14.5px] leading-snug font-medium tracking-[-0.01em] text-[var(--ink)]">
                {course.title}
              </p>
              <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
                {course.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge tone="outline">{DIFFICULTY_LABEL[course.difficulty]}</Badge>
                <Badge tone="outline">{pluralize(course.modules.length, "module")}</Badge>
                <Badge tone="outline">{pluralize(countLessons(course), "lesson")}</Badge>
                {course.quality && (
                  <Badge tone={course.quality.overall >= 85 ? "positive" : "warn"}>
                    {course.quality.overall}%
                  </Badge>
                )}
              </div>
              <p className="mt-3 text-[11.5px] text-[var(--ink-faint)]">
                Edited {relativeTime(savedAt)}
              </p>
            </Link>
            <div className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Menu
                width={168}
                trigger={
                  <Button variant="ghost" size="iconSm" aria-label="Course options">
                    <MoreHorizontal />
                  </Button>
                }
              >
                <MenuItem icon={<Trash2 />} danger onSelect={() => setPendingDelete(course.id)}>
                  Delete course
                </MenuItem>
              </Menu>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeCourse(pendingDelete)}
        title="Delete this course?"
        description={`“${target?.course.title ?? ""}” will be removed from this browser. This cannot be undone.`}
      />
    </section>
  );
}
