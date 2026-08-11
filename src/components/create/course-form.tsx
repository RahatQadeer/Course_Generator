"use client";

import { SourceMaterialPanel } from "@/components/create/source-material";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, SectionLabel, Segmented, Switch } from "@/components/ui/primitives";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  TEACHING_STYLES,
  TEACHING_STYLE_LABEL,
  type GenerationRequest,
} from "@/lib/schema/course";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown, Layers, Sliders, Wand2 } from "lucide-react";
import * as React from "react";

const DURATIONS = [
  "1 hour",
  "2 hours",
  "Half a day",
  "1 day",
  "1 week",
  "2 weeks",
  "4 weeks",
  "6 weeks",
  "8 weeks",
  "12 weeks",
  "1 semester",
];

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Dutch",
  "Arabic",
  "Hindi",
  "Urdu",
  "Chinese (Simplified)",
  "Japanese",
  "Korean",
  "Indonesian",
  "Turkish",
];

const EXAMPLES = [
  "A practical course teaching independent bookkeepers how to run month-end close for small retail clients",
  "Full stack web development for beginner software engineering students",
  "Clinical documentation and coding for new physician assistants",
  "Prompt engineering for marketing teams who have never used an LLM",
];

export const DEFAULT_REQUEST: GenerationRequest = {
  topic: "",
  title: "",
  description: "",
  audience: "",
  difficulty: "beginner",
  duration: "4 weeks",
  moduleCount: 6,
  language: "English",
  teachingStyle: "practical",
  sources: [],
  depth: "standard",
  includeQuizzes: true,
  includeFinalAssessment: true,
};

export function CourseForm({
  value,
  onChange,
  onSubmit,
  submitting,
}: {
  value: GenerationRequest;
  onChange: (value: GenerationRequest) => void;
  onSubmit: () => void;
  submitting?: boolean;
}) {
  const [advanced, setAdvanced] = React.useState(false);
  const [showSources, setShowSources] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const set = <K extends keyof GenerationRequest>(key: K, next: GenerationRequest[K]) =>
    onChange({ ...value, [key]: next });

  const topicError = touched && value.topic.trim().length < 8 ? "Describe the course in a sentence or two." : "";
  const audienceError = touched && value.audience.trim().length < 3 ? "Who is this course for?" : "";
  const valid = value.topic.trim().length >= 8 && value.audience.trim().length >= 3;

  const submit = () => {
    setTouched(true);
    if (valid) onSubmit();
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-[36px]">
          What course do you want to create?
        </h1>
        <p className="mx-auto mt-2.5 max-w-lg text-[15px] leading-relaxed text-[var(--ink-soft)]">
          Describe the topic, audience and outcome. CourseGen drafts the full structure, lessons and
          assessments — you refine and publish.
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="space-y-5">
          <Field label="Course topic" error={topicError} htmlFor="topic">
            <Textarea
              id="topic"
              autoFocus
              rows={3}
              value={value.topic}
              onChange={(event) => set("topic", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
              }}
              placeholder="e.g. A practical course teaching independent bookkeepers how to run month-end close for small retail clients…"
              disabled={submitting}
              className={cn(topicError && "border-[var(--danger)]")}
            />
          </Field>

          {!value.topic && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => set("topic", example)}
                  className="focus-ring rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-left text-[11.5px] text-[var(--ink-soft)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  {example.length > 58 ? `${example.slice(0, 56)}…` : example}
                </button>
              ))}
            </div>
          )}

          <Field label="Target audience" error={audienceError} htmlFor="audience">
            <Input
              id="audience"
              value={value.audience}
              onChange={(event) => set("audience", event.target.value)}
              placeholder="Beginner developers with no backend experience"
              disabled={submitting}
              className={cn(audienceError && "border-[var(--danger)]")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Difficulty" htmlFor="difficulty">
              <Select
                id="difficulty"
                value={value.difficulty}
                onChange={(event) => set("difficulty", event.target.value as GenerationRequest["difficulty"])}
                disabled={submitting}
              >
                {DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>
                    {DIFFICULTY_LABEL[level]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Duration" htmlFor="duration">
              <Select
                id="duration"
                value={value.duration}
                onChange={(event) => set("duration", event.target.value)}
                disabled={submitting}
              >
                {DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Modules" htmlFor="modules">
              <Input
                id="modules"
                type="number"
                min={1}
                max={16}
                value={value.moduleCount}
                onChange={(event) =>
                  set("moduleCount", Math.max(1, Math.min(16, Number(event.target.value) || 1)))
                }
                disabled={submitting}
              />
            </Field>
          </div>

          {/* Source material ------------------------------------------------ */}
          <div className="rounded-[var(--radius)] border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setShowSources((open) => !open)}
              className="focus-ring flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <Layers className="size-4 text-[var(--ink-faint)]" />
              <span className="flex-1 text-[13.5px] font-medium text-[var(--ink)]">
                Source material
                <span className="ml-2 font-normal text-[var(--ink-faint)]">
                  {value.sources.length
                    ? `${value.sources.length} added`
                    : "optional — ground the course in your own documents"}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-[var(--ink-faint)] transition-transform",
                  showSources && "rotate-180",
                )}
              />
            </button>
            {showSources && (
              <div className="border-t border-[var(--line)] p-3.5">
                <SourceMaterialPanel
                  sources={value.sources}
                  onChange={(sources) => set("sources", sources)}
                  disabled={submitting}
                />
              </div>
            )}
          </div>

          {/* Advanced -------------------------------------------------------- */}
          <div className="rounded-[var(--radius)] border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setAdvanced((open) => !open)}
              className="focus-ring flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <Sliders className="size-4 text-[var(--ink-faint)]" />
              <span className="flex-1 text-[13.5px] font-medium text-[var(--ink)]">
                Fine-tuning
                <span className="ml-2 font-normal text-[var(--ink-faint)]">
                  title, style, language, depth
                </span>
              </span>
              <ChevronDown
                className={cn("size-4 text-[var(--ink-faint)] transition-transform", advanced && "rotate-180")}
              />
            </button>

            {advanced && (
              <div className="animate-fade-in space-y-5 border-t border-[var(--line)] p-3.5">
                <Field label="Course title" optional htmlFor="title" hint="Leave blank and the AI writes one">
                  <Input
                    id="title"
                    value={value.title ?? ""}
                    onChange={(event) => set("title", event.target.value)}
                    placeholder="Month-End Close for Retail Bookkeeping"
                    disabled={submitting}
                  />
                </Field>

                <Field
                  label="Extra instructions"
                  optional
                  htmlFor="description"
                  hint="Anything the AI must know"
                >
                  <Textarea
                    id="description"
                    rows={3}
                    value={value.description ?? ""}
                    onChange={(event) => set("description", event.target.value)}
                    placeholder="Must cover UK VAT rules. Avoid US-specific examples. Learners use Xero."
                    disabled={submitting}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Teaching style" htmlFor="style">
                    <Select
                      id="style"
                      value={value.teachingStyle}
                      onChange={(event) =>
                        set("teachingStyle", event.target.value as GenerationRequest["teachingStyle"])
                      }
                      disabled={submitting}
                    >
                      {TEACHING_STYLES.map((style) => (
                        <option key={style} value={style}>
                          {TEACHING_STYLE_LABEL[style]}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Language" htmlFor="language">
                    <Select
                      id="language"
                      value={value.language}
                      onChange={(event) => set("language", event.target.value)}
                      disabled={submitting}
                    >
                      {LANGUAGES.map((language) => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="space-y-2">
                  <SectionLabel>Lesson depth</SectionLabel>
                  <Segmented
                    value={value.depth}
                    onChange={(depth) => set("depth", depth)}
                    className="w-full"
                    options={[
                      { value: "concise", label: "Concise" },
                      { value: "standard", label: "Standard" },
                      { value: "comprehensive", label: "Comprehensive" },
                    ]}
                  />
                  <p className="text-[11.5px] text-[var(--ink-faint)]">
                    {value.depth === "concise"
                      ? "Short, high-signal lessons. Fastest to generate."
                      : value.depth === "comprehensive"
                        ? "Long-form lessons with deeper explanation and more examples. Takes longer."
                        : "Balanced lessons of roughly 800–1,100 words."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Switch
                    checked={value.includeQuizzes}
                    onCheckedChange={(checked) => set("includeQuizzes", checked)}
                    label="Quizzes"
                    description="Per lesson and per module"
                    disabled={submitting}
                  />
                  <Switch
                    checked={value.includeFinalAssessment}
                    onCheckedChange={(checked) => set("includeFinalAssessment", checked)}
                    label="Final assessment"
                    description="Summative, covers everything"
                    disabled={submitting}
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={submit}
            loading={submitting}
          >
            {!submitting && <Wand2 />}
            Generate course
            {!submitting && <ArrowRight className="opacity-80" />}
          </Button>

          <p className="text-center text-[11.5px] text-[var(--ink-faint)]">
            Roughly {estimateMinutes(value)} to generate · {value.moduleCount} modules
            {value.sources.length ? ` · grounded in ${value.sources.length} source${value.sources.length > 1 ? "s" : ""}` : ""}
          </p>
        </div>
      </Card>
    </div>
  );
}

function estimateMinutes(request: GenerationRequest): string {
  const lessons = request.moduleCount * 3;
  const perLesson = request.depth === "comprehensive" ? 9 : request.depth === "concise" ? 4 : 6;
  const seconds = 45 + (lessons * perLesson) / 5 + request.moduleCount * 12;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes <= 1 ? "a minute" : `${minutes}–${minutes + 2} minutes`;
}
