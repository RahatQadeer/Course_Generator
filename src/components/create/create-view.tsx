"use client";

import { TopBar } from "@/components/app-shell";
import { CourseForm, DEFAULT_REQUEST } from "@/components/create/course-form";
import { RecentCourses } from "@/components/create/recent-courses";
import { ProgressView, initialStages, type StageMap } from "@/components/generate/progress-view";
import { Button } from "@/components/ui/button";
import type { StageId } from "@/lib/ai/stages";
import type { Course, GenerationRequest } from "@/lib/schema/course";
import { streamPost } from "@/lib/sse";
import { useCourseStore } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

const DRAFT_KEY = "coursegen.draft.v1";

function readDraft(): GenerationRequest {
  if (typeof localStorage === "undefined") return DEFAULT_REQUEST;
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    return stored ? { ...DEFAULT_REQUEST, ...JSON.parse(stored), sources: [] } : DEFAULT_REQUEST;
  } catch {
    return DEFAULT_REQUEST;
  }
}

export function CreateView() {
  const router = useRouter();
  const saveCourse = useCourseStore((state) => state.saveCourse);

  const hydrated = useHydrated();
  // The saved draft only exists on the client. Nothing that depends on it is
  // rendered until after hydration, so the initialiser can read it directly.
  const [request, setRequest] = React.useState<GenerationRequest>(readDraft);
  const [phase, setPhase] = React.useState<"form" | "generating">("form");
  const [stages, setStages] = React.useState<StageMap>(initialStages);
  const [skeleton, setSkeleton] = React.useState<Course | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (phase !== "form") return;
    const timer = setTimeout(() => {
      try {
        // Source text can be large; keep only metadata in the draft.
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ ...request, sources: [] }),
        );
      } catch {
        /* quota — not worth surfacing */
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [request, phase]);

  /* Warn before losing an in-flight generation. */
  React.useEffect(() => {
    if (phase !== "generating") return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const generate = React.useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("generating");
    setStages(initialStages());
    setSkeleton(null);
    setError(null);

    try {
      await streamPost(
        "/api/generate",
        request,
        (event) => {
          switch (event.type) {
            case "stage":
              setStages((previous) => ({
                ...previous,
                [event.stage as StageId]: {
                  status: event.status,
                  detail: event.detail ?? previous[event.stage as StageId].detail,
                  progress: event.progress,
                },
              }));
              break;
            case "skeleton":
              setSkeleton(event.course);
              break;
            case "done":
              saveCourse(event.course);
              toast.success("Course ready", {
                description: `${event.course.modules.length} modules · ${event.course.modules.reduce(
                  (sum, module) => sum + module.lessons.length,
                  0,
                )} lessons${event.course.quality ? ` · ${event.course.quality.overall}% quality` : ""}`,
              });
              router.push(`/course/${event.course.id}`);
              break;
            case "error":
              setError(event.message);
              break;
          }
        },
        controller.signal,
      );

      // The stream ended without a terminal event.
      setError((current) =>
        current ?? "The connection closed before the course was finished. Try again.",
      );
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "Generation failed.");
    }
  }, [request, router, saveCourse]);

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("form");
    setError(null);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        right={
          phase === "form" ? (
            <Button variant="ghost" size="sm" asChild>
              <a href="#library">
                <BookOpen />
                My courses
              </a>
            </Button>
          ) : null
        }
      />

      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {phase === "form" ? (
          <div className="space-y-16">
            {hydrated ? (
              <CourseForm value={request} onChange={setRequest} onSubmit={generate} />
            ) : (
              <FormSkeleton />
            )}
            <RecentCourses />
          </div>
        ) : (
          <ProgressView
            stages={stages}
            skeleton={skeleton}
            error={error}
            onCancel={cancel}
            onRetry={generate}
            title={request.title?.trim() || request.topic}
          />
        )}
      </main>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="skeleton h-9 w-[70%]" />
        <div className="skeleton h-4 w-[55%]" />
      </div>
      <div className="rounded-[calc(var(--radius)+4px)] border border-[var(--line)] bg-[var(--surface)] p-6">
        <div className="space-y-5">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-10 w-full" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
          <div className="skeleton h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
