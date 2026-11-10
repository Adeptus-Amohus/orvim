import { useState } from "react";
import { ArrowRight, BookOpen, Check } from "lucide-react";
import type { Snapshot } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { repository } from "../../data/repository";
import { displayDate, weekStart } from "../../domain/dates";
import { reviewSections } from "../../domain/reviews";
import {
  EmptyState,
  ErrorNotice,
  PageHeader,
  useOperation,
} from "../../components/ui";
import { ReviewEditor } from "./ReviewEditor";
import type { RegisterGuard } from "./ReviewEditor";

export function ReviewPage({
  data,
  today,
  mutate,
  registerGuard,
  notify,
}: {
  data: Snapshot;
  today: string;
  mutate: Workspace["mutate"];
  registerGuard: RegisterGuard;
  notify: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const op = useOperation();
  const review = data.reviews.find((r) => r.id === selected);
  const unfinished = data.reviews.find((r) => r.status === "in_progress");
  const current = data.reviews.find((r) => r.period_start === weekStart(today));
  if (review)
    return (
      <ReviewEditor
        key={review.id}
        review={review}
        data={data}
        mutate={mutate}
        registerGuard={registerGuard}
        onExit={() => {
          setSelected(null);
          requestAnimationFrame(() => {
            document
              .querySelector<HTMLElement>("main h1")
              ?.focus({ preventScroll: true });
          });
        }}
        notify={notify}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="LOOK BACK. MAKE ROOM."
        title="Your weekly pause."
        description="Notice what happened. Make a little room for what comes next."
      />
      <section className="card review-invitation">
        <span className="review-symbol">
          <BookOpen size={28} strokeWidth={1.5} />
        </span>
        <div>
          <h2>
            {unfinished
              ? "Pick up where you left off"
              : current?.status === "completed"
                ? "You've made space for reflection"
                : "A little reflection goes a long way"}
          </h2>
          <p>
            {unfinished
              ? `Review for ${displayDate(unfinished.period_start)} · Resume at ${reviewSections[unfinished.current_step]?.title ?? "Inbox"}.`
              : current
                ? "This week's review is complete. You can revisit it anytime."
                : "Ten prompts, one at a time. Skip any, and come back whenever you need."}
          </p>
        </div>
        <button
          className="button primary"
          disabled={op.busy}
          onClick={() => {
            void op.run(async () => {
              const key = await mutate(() =>
                repository.startReview(weekStart(today)),
              );
              setSelected(key);
            });
          }}
        >
          {unfinished
            ? "Resume review"
            : current
              ? "View this week's review"
              : "Begin weekly review"}
          <ArrowRight size={16} />
        </button>
      </section>
      <ErrorNotice message={op.error} />
      <div className="section-heading history-heading">
        <h2>Your reflections</h2>
        <span className="muted">
          {data.reviews.length}{" "}
          {data.reviews.length === 1 ? "review" : "reviews"}
        </span>
      </div>
      {data.reviews.length === 0 ? (
        <section className="card">
          <EmptyState
            kind="done"
            title="A place to come back to"
            description="Your reflections will live here. A few words are enough to begin."
          />
        </section>
      ) : (
        <div className="review-history">
          {data.reviews.map((r) => (
            <button
              className="card review-history-row"
              key={r.id}
              onClick={() => setSelected(r.id)}
            >
              <div>
                <strong>
                  {displayDate(r.period_start)} –{" "}
                  {displayDate(r.period_end, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </strong>
                <span>
                  {r.status === "completed"
                    ? "Completed"
                    : `In progress · Step ${r.current_step + 1} of 10`}
                </span>
              </div>
              {r.status === "completed" ? (
                <Check size={19} />
              ) : (
                <ArrowRight size={19} />
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
