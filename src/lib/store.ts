"use client";

import * as ops from "@/lib/course-ops";
import type { Course } from "@/lib/schema/course";
import type { ThemeOverrides } from "@/lib/themes";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

export type CourseRecord = {
  course: Course;
  themeOverrides: ThemeOverrides;
  savedAt: string;
};

type State = {
  courses: Record<string, CourseRecord>;
  order: string[];
  hydrated: boolean;
};

type Actions = {
  saveCourse: (course: Course) => void;
  getCourse: (courseId: string) => Course | undefined;
  removeCourse: (courseId: string) => void;
  /** Apply a pure transform and persist the result. */
  mutate: (courseId: string, fn: (course: Course) => Course) => void;
  setThemeOverrides: (courseId: string, overrides: ThemeOverrides) => void;
  getThemeOverrides: (courseId: string) => ThemeOverrides;
};

export const useCourseStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      courses: {},
      order: [],
      hydrated: false,

      saveCourse: (course) =>
        set((state) => ({
          courses: {
            ...state.courses,
            [course.id]: {
              course,
              themeOverrides: state.courses[course.id]?.themeOverrides ?? {},
              savedAt: new Date().toISOString(),
            },
          },
          order: [course.id, ...state.order.filter((entryId) => entryId !== course.id)],
        })),

      getCourse: (courseId) => get().courses[courseId]?.course,

      removeCourse: (courseId) =>
        set((state) => {
          const courses = { ...state.courses };
          delete courses[courseId];
          return { courses, order: state.order.filter((entryId) => entryId !== courseId) };
        }),

      mutate: (courseId, fn) =>
        set((state) => {
          const record = state.courses[courseId];
          if (!record) return state;
          const next = fn(record.course);
          return {
            courses: {
              ...state.courses,
              [courseId]: { ...record, course: next, savedAt: new Date().toISOString() },
            },
          };
        }),

      setThemeOverrides: (courseId, overrides) =>
        set((state) => {
          const record = state.courses[courseId];
          if (!record) return state;
          return {
            courses: {
              ...state.courses,
              [courseId]: { ...record, themeOverrides: overrides, savedAt: new Date().toISOString() },
            },
          };
        }),

      getThemeOverrides: (courseId) => get().courses[courseId]?.themeOverrides ?? {},
    }),
    {
      name: "coursegen.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ courses: state.courses, order: state.order }) as State,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/** Convenience: subscribe to one course. */
export function useCourse(courseId: string): Course | undefined {
  return useCourseStore((state) => state.courses[courseId]?.course);
}

export function useCourseList(): CourseRecord[] {
  return useCourseStore(
    useShallow((state) =>
      state.order.map((courseId) => state.courses[courseId]).filter(Boolean),
    ),
  );
}

export { ops };
