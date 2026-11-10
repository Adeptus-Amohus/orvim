import { Trash2 } from "lucide-react";
import type { Snapshot, Win } from "../../domain/models";
import { displayDate } from "../../domain/dates";
import { AreaBadge } from "../../components/ui";

export function WinMonth({
  month,
  wins,
  data,
  onDelete,
}: {
  month: string;
  wins: Win[];
  data: Snapshot;
  onDelete: (win: Win) => void;
}) {
  const headingId = `wins-${month}`;
  return (
    <section className="timeline-month" aria-labelledby={headingId}>
      <header className="month-heading">
        <p className="eyebrow">{month.slice(0, 4)}</p>
        <h2 id={headingId}>{displayDate(`${month}-01`, { month: "long" })}</h2>
        <span>
          {wins.length} {wins.length === 1 ? "Win" : "Wins"}
        </span>
      </header>
      <div className="timeline-items">
        {[...wins]
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
          .map((win) => {
            const area = data.areas.find((a) => a.id === win.area_id);
            return (
              <article
                className={`win-entry${area ? ` accent-${area.accent}` : ""}`}
                key={win.id}
              >
                <span className="timeline-dot" aria-hidden="true" />
                <div className="card-top">
                  <time dateTime={win.occurred_at}>
                    {displayDate(win.occurred_at, {
                      day: "numeric",
                      month: "long",
                    })}
                  </time>
                  <button
                    className="icon-button"
                    aria-label={`Delete Win: ${win.title}`}
                    onClick={() => onDelete(win)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <h3>{win.title}</h3>
                {win.note && <p className="preserve-lines">{win.note}</p>}
                <div className="win-meta">
                  <AreaBadge area={area} />
                  {win.project_id && (
                    <small>
                      {
                        data.projects.find((p) => p.id === win.project_id)
                          ?.title
                      }
                    </small>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
