"use client";

import { QUESTION_TYPE_LABEL, type Question, type Quiz } from "@/lib/schema/course";
import { cn } from "@/lib/utils";
import { Check, Eye, EyeOff } from "lucide-react";
import * as React from "react";

/** Quiz rendering used by the workspace, the preview and the HTML export. */
export function QuizView({
  quiz,
  className,
  defaultRevealed = false,
}: {
  quiz: Quiz;
  className?: string;
  defaultRevealed?: boolean;
}) {
  const [revealed, setRevealed] = React.useState(defaultRevealed);
  const points = quiz.questions.reduce((sum, question) => sum + question.points, 0);

  return (
    <section className={cn("space-y-4", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="ct-display text-[19px] font-semibold">{quiz.title}</h3>
          {quiz.description && (
            <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--ct-muted)]">
              {quiz.description}
            </p>
          )}
          <p className="mt-1.5 text-[12.5px] text-[var(--ct-muted)]">
            {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · {points} points ·
            pass at {quiz.passingScore}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="focus-ring no-print inline-flex items-center gap-1.5 rounded-[var(--ct-radius)] border border-[var(--ct-line)] px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--ct-muted)] transition-colors hover:text-[var(--ct-text)]"
        >
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {revealed ? "Hide answers" : "Show answers"}
        </button>
      </header>

      <ol className="space-y-4">
        {quiz.questions.map((question, index) => (
          <QuestionCard key={question.id} question={question} index={index} revealed={revealed} />
        ))}
      </ol>
    </section>
  );
}

export function QuestionCard({
  question,
  index,
  revealed,
}: {
  question: Question;
  index: number;
  revealed: boolean;
}) {
  const correct = new Set(question.correctOptionIndexes);

  return (
    <li className="ct-card print-avoid-break list-none px-4 py-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--ct-accent-soft)] text-[12px] font-semibold text-[var(--ct-primary)] tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-[1.6] font-medium text-[var(--ct-heading)]">
            {question.question}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-[var(--ct-muted)]">
            <span>{QUESTION_TYPE_LABEL[question.type]}</span>
            <span aria-hidden>·</span>
            <span className="capitalize">{question.difficulty}</span>
            <span aria-hidden>·</span>
            <span>
              {question.points} point{question.points === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {question.type === "short-answer" ? (
        <div className="ml-9 space-y-2">
          <div className="rounded-[var(--ct-radius)] border border-dashed border-[var(--ct-line)] px-3 py-6 text-[13px] text-[var(--ct-muted)]">
            Written answer
          </div>
          {revealed && question.sampleAnswer && (
            <div className="rounded-[var(--ct-radius)] bg-[var(--ct-accent-soft)] px-3 py-2.5">
              <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-[var(--ct-primary)] uppercase">
                Model answer
              </p>
              <p className="text-[14px] leading-[1.6] text-[var(--ct-text)]">{question.sampleAnswer}</p>
            </div>
          )}
        </div>
      ) : (
        <ul className="ml-9 space-y-1.5">
          {question.options.map((option, optionIndex) => {
            const isCorrect = correct.has(optionIndex);
            return (
              <li
                key={optionIndex}
                className={cn(
                  "flex items-start gap-2.5 rounded-[var(--ct-radius)] border px-3 py-2 text-[14.5px] leading-[1.55] transition-colors",
                  revealed && isCorrect
                    ? "border-[var(--ct-accent)] bg-[var(--ct-accent-soft)] text-[var(--ct-heading)]"
                    : "border-[var(--ct-line)] text-[var(--ct-text)]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold",
                    question.type === "multi-select" ? "rounded-[4px]" : "rounded-full",
                    revealed && isCorrect
                      ? "border-[var(--ct-accent)] bg-[var(--ct-accent)] text-white"
                      : "border-[var(--ct-line)] text-[var(--ct-muted)]",
                  )}
                >
                  {revealed && isCorrect ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : (
                    String.fromCharCode(65 + optionIndex)
                  )}
                </span>
                <span>{option}</span>
              </li>
            );
          })}
        </ul>
      )}

      {revealed && question.explanation && (
        <p className="mt-3 ml-9 border-t border-[var(--ct-line)] pt-2.5 text-[13.5px] leading-[1.6] text-[var(--ct-muted)]">
          <span className="font-semibold text-[var(--ct-primary)]">Why — </span>
          {question.explanation}
        </p>
      )}
    </li>
  );
}
