"use client";

import type { AIOperation } from "@/lib/ai/operations";
import type { Course } from "@/lib/schema/course";
import { streamPost } from "@/lib/sse";
import { useCourseStore } from "@/lib/store";
import * as React from "react";
import { toast } from "sonner";

export type AIJob = {
  /** Identifies which UI element is busy, e.g. `lesson:abc` or `course`. */
  key: string;
  label: string;
  detail?: string;
  progress?: number;
};

/**
 * Runs a server AI operation, streams its progress, and persists the returned
 * course. Only one job runs at a time — concurrent edits to the same course
 * would clobber each other.
 */
export function useAIAction(courseId: string) {
  const saveCourse = useCourseStore((state) => state.saveCourse);
  const [job, setJob] = React.useState<AIJob | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const run = React.useCallback(
    async (
      course: Course,
      operation: AIOperation,
      options: { key: string; label: string; success?: string },
    ): Promise<Course | null> => {
      if (abortRef.current) {
        toast.error("One AI task at a time", {
          description: "Wait for the current one to finish, or cancel it.",
        });
        return null;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setJob({ key: options.key, label: options.label });

      let result: Course | null = null;
      let failure: string | null = null;

      try {
        await streamPost(
          "/api/ai",
          { course, operation },
          (event) => {
            if (event.type === "stage") {
              setJob((current) =>
                current ? { ...current, detail: event.detail, progress: event.progress } : current,
              );
            } else if (event.type === "done") {
              result = event.course;
            } else if (event.type === "error") {
              failure = event.message;
            }
          },
          controller.signal,
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          failure = error instanceof Error ? error.message : "The request failed.";
        }
      } finally {
        abortRef.current = null;
        setJob(null);
      }

      if (failure) {
        toast.error(options.label, { description: failure });
        return null;
      }
      if (result) {
        saveCourse(result);
        toast.success(options.success ?? `${options.label} — done`);
        return result;
      }
      if (!controller.signal.aborted) {
        toast.error(options.label, { description: "The connection closed early. Try again." });
      }
      return null;
    },
    [saveCourse],
  );

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setJob(null);
  }, []);

  void courseId;
  return { job, run, cancel, busy: job !== null };
}
