import { reviewSections } from "../../domain/reviews";

export function ReviewProgress({
  step,
  busy,
  onMove,
}: {
  step: number;
  busy: boolean;
  onMove: (step: number) => void;
}) {
  return (
    <nav className="review-progress" aria-label="Review steps">
      <span>
        Step {step + 1} of {reviewSections.length}
      </span>
      <label>
        <span>Jump to</span>
        <select
          aria-label="Review section"
          value={step}
          disabled={busy}
          onChange={(event) => onMove(Number(event.target.value))}
        >
          {reviewSections.map((section, index) => (
            <option key={section.id} value={index}>
              {index + 1}. {section.title}
            </option>
          ))}
        </select>
      </label>
      <div className="step-track" aria-hidden="true">
        {reviewSections.map((section, index) => (
          <span
            key={section.id}
            className={index <= step ? "visited" : undefined}
          />
        ))}
      </div>
    </nav>
  );
}
