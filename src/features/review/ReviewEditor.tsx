import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { Review, Snapshot } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { useReviewDraft } from "../../application/useReviewDraft";
import { reviewSections } from "../../domain/reviews";
import { dateKey, displayDate } from "../../domain/dates";
import { ErrorNotice, Field } from "../../components/ui";
import { ReviewProgress } from "./ReviewProgress";

export type RegisterGuard = (guard: (() => Promise<boolean>) | null) => void;
export function ReviewEditor({
  review,
  data,
  mutate,
  onExit,
  registerGuard,
  notify,
}: {
  review: Review;
  data: Snapshot;
  mutate: Workspace["mutate"];
  onExit: () => void;
  registerGuard: RegisterGuard;
  notify: (message: string) => void;
}) {
  const model = useReviewDraft(
    review,
    data.review_entries.filter((e) => e.review_id === review.id),
    mutate,
  );
  const { draft, change, persist, saving, error, dirty } = model;
  const [moving, setMoving] = useState(false);
  const readOnly = review.status === "completed";
  const section = reviewSections[draft.step] ?? reviewSections[0];
  useEffect(() => {
    document.getElementById("review-heading")?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    registerGuard(readOnly ? null : () => persist());
    return () => registerGuard(null);
  }, [persist, registerGuard, readOnly]);
  const move = async (step: number) => {
    if (moving) return;
    setMoving(true);
    change((d) => ({ ...d, step }));
    await persist();
    setMoving(false);
    document.getElementById("review-heading")?.focus();
  };
  const leave = async () => {
    if (await persist()) onExit();
  };
  let context: string[] = [];
  if (section.id === "inbox")
    context = data.inbox_items
      .filter((i) => !i.processed_at)
      .slice(0, 5)
      .map((i) => i.content);
  if (section.id === "projects")
    context = data.projects
      .filter((p) => p.status === "active")
      .slice(0, 5)
      .map((p) => p.title);
  if (section.id === "wins")
    context = data.wins
      .filter(
        (w) =>
          dateKey(new Date(w.occurred_at)) >= review.period_start &&
          dateKey(new Date(w.occurred_at)) <= review.period_end,
      )
      .slice(0, 5)
      .map((w) => w.title);
  return (
    <div className="review-editor">
      <div className="review-top">
        <button
          className="text-button"
          disabled={moving}
          onClick={() => {
            void leave();
          }}
        >
          <ArrowLeft size={16} />
          {readOnly ? "All reviews" : "Save for later"}
        </button>
        <span
          className={`save-state${error ? " error-text" : saving || dirty ? " pending" : ""}`}
          role="status"
        >
          {readOnly
            ? "Completed review"
            : error
              ? "Not saved — please retry"
              : saving
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : "All changes saved"}
        </span>
      </div>
      <p className="eyebrow">
        WEEKLY REVIEW · {displayDate(review.period_start)} –{" "}
        {displayDate(review.period_end)}
      </p>
      <ReviewProgress
        step={draft.step}
        busy={moving}
        onMove={(step) => {
          void move(step);
        }}
      />
      <section
        className="card reflection-card reflection-prompt"
        key={section.id}
      >
        <p className="eyebrow">{section.title}</p>
        <h1 id="review-heading" tabIndex={-1}>
          {section.prompt}
        </h1>
        <p className="page-description">{section.hint}</p>
        {context.length > 0 && (
          <aside
            className={`review-context${section.id === "wins" ? " wins-context" : ""}`}
          >
            <span className="eyebrow">
              {section.id === "wins"
                ? "GOOD THINGS FROM THIS WEEK"
                : "A FEW REMINDERS"}
            </span>
            <ul>
              {context.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </aside>
        )}
        {draft.step === 9 && (
          <div className="focus-fields">
            <div>
              <h2>Up to three focuses</h2>
              <p className="muted">
                Write your own, or choose an active project. One is enough.
              </p>
            </div>
            <datalist id="focus-suggestions">
              {data.projects
                .filter((p) => p.status === "active")
                .map((p) => (
                  <option key={p.id} value={p.title} />
                ))}
            </datalist>
            {draft.focuses.map((focus, index) => (
              <Field key={index} label={`Focus ${index + 1} (optional)`}>
                <input
                  list="focus-suggestions"
                  maxLength={200}
                  readOnly={readOnly}
                  value={focus}
                  onChange={(e) => {
                    const value = e.target.value;
                    change((d) => ({
                      ...d,
                      focuses: d.focuses.map((f, i) =>
                        i === index ? value : f,
                      ),
                    }));
                  }}
                  placeholder={
                    ["Make room for…", "Give attention to…", "Keep space for…"][
                      index
                    ]
                  }
                />
              </Field>
            ))}
          </div>
        )}
        <Field label={`${section.title} reflection`}>
          <textarea
            key={section.id}
            rows={draft.step === 9 ? 3 : 7}
            maxLength={10000}
            readOnly={readOnly}
            value={draft.entries[section.id] ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              change((d) => ({
                ...d,
                entries: { ...d.entries, [section.id]: value },
              }));
            }}
            placeholder="Write a little, or leave this blank. This space is yours."
          />
        </Field>
        <ErrorNotice message={error} />
        {error && (
          <button
            className="button secondary"
            onClick={() => {
              void persist();
            }}
          >
            Retry saving
          </button>
        )}
        <div className="review-controls">
          <button
            className="button secondary"
            disabled={draft.step === 0 || moving}
            onClick={() => {
              void move(draft.step - 1);
            }}
          >
            <ArrowLeft size={16} />
            Previous
          </button>
          {draft.step < 9 ? (
            <button
              className="button primary"
              disabled={moving}
              onClick={() => {
                void move(draft.step + 1);
              }}
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="button primary"
              disabled={moving || saving}
              onClick={() => {
                if (readOnly) {
                  onExit();
                  return;
                }
                setMoving(true);
                void persist(true).then((ok) => {
                  setMoving(false);
                  if (ok) {
                    notify(
                      "Review complete. A little more clarity for the week ahead.",
                    );
                    onExit();
                  }
                });
              }}
            >
              <Check size={16} />
              {readOnly ? "Back to reviews" : "Finish review"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
