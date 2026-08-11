"use client";

import type { Course } from "@/lib/schema/course";
import type { ThemeOverrides } from "@/lib/themes";
import { slugify } from "@/lib/utils";
import { courseToHtml } from "./html";

export type ExportFormat = {
  id: string;
  label: string;
  extension: string;
  run: (course: Course, overrides: ThemeOverrides) => void | Promise<void>;
};

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCourseJson(course: Course) {
  download(`${slugify(course.title)}.json`, JSON.stringify(course, null, 2), "application/json");
}

export function downloadCourseHtml(course: Course, overrides: ThemeOverrides = {}) {
  download(`${slugify(course.title)}.html`, courseToHtml(course, overrides), "text/html");
}

/**
 * PDF export goes through the browser's own print pipeline against the themed
 * preview page, so the output matches the on-screen design exactly.
 */
export function printCourse(courseId: string) {
  window.open(`/course/${courseId}/preview?print=1`, "_blank", "noopener");
}

/** Registry — new formats plug in here without touching the UI. */
export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: "html",
    label: "HTML",
    extension: "html",
    run: (course, overrides) => downloadCourseHtml(course, overrides),
  },
  {
    id: "json",
    label: "Course JSON",
    extension: "json",
    run: (course) => downloadCourseJson(course),
  },
];

export { courseToHtml };
