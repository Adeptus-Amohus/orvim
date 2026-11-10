import { useState } from "react";
import { Archive, ArrowRight, CalendarDays, Pencil, Play } from "lucide-react";
import type { Project, ProjectStatus, Snapshot } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { repository } from "../../data/repository";
import { displayDate } from "../../domain/dates";
import {
  AddButton,
  AreaBadge,
  EmptyState,
  ErrorNotice,
  PageHeader,
  useOperation,
} from "../../components/ui";

export function ProjectsPage({
  data,
  mutate,
  onEdit,
  onCreate,
  onPlan,
  notify,
  someday = false,
}: {
  data: Snapshot;
  mutate: Workspace["mutate"];
  onEdit: (project: Project) => void;
  onCreate: (status: ProjectStatus) => void;
  onPlan: (project: Project) => void;
  notify: (message: string) => void;
  someday?: boolean;
}) {
  const [status, setStatus] = useState<ProjectStatus>(
    someday ? "paused" : "active",
  );
  const op = useOperation();
  const filtered = data.projects.filter(
    (p) => p.status === (someday ? "paused" : status),
  );
  const changeStatus = (p: Project, next: ProjectStatus) => {
    void op.run(async () => {
      await mutate(() => repository.setProjectStatus(p.id, next));
      notify(
        next === "archived"
          ? "Project archived. Find it in the Archived filter."
          : "Project is active again.",
      );
    });
  };
  return (
    <>
      <PageHeader
        eyebrow={someday ? "ROOM FOR LATER" : "ONE STEP AT A TIME"}
        title={someday ? "Someday" : "Projects"}
        description={
          someday
            ? "Interesting, but not a commitment. Keep your possibilities here."
            : "What you're making room for, one next step at a time."
        }
        action={
          <AddButton onClick={() => onCreate(someday ? "paused" : "active")}>
            {someday ? "Add an idea" : "New project"}
          </AddButton>
        }
      />
      {!someday && (
        <div className="tabs" role="group" aria-label="Project status">
          {(["active", "paused", "completed", "archived"] as const).map((s) => (
            <button
              key={s}
              className={status === s ? "selected" : ""}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s[0]?.toUpperCase()}
              {s.slice(1)}{" "}
              <span>{data.projects.filter((p) => p.status === s).length}</span>
            </button>
          ))}
        </div>
      )}
      <ErrorNotice message={op.error} />
      {filtered.length === 0 ? (
        <section className="card">
          <EmptyState
            kind="projects"
            title={someday ? "Let an idea wait here" : `No ${status} projects`}
            description={
              someday
                ? "Keep a possibility without turning it into a commitment."
                : status === "active"
                  ? "Choose one thing you'd like to move forward."
                  : status === "paused"
                    ? "Projects you set aside will be waiting here."
                    : status === "completed"
                      ? "Finished projects will have a place here."
                      : "Projects you archive stay available here."
            }
          >
            {(someday || status === "active") && (
              <AddButton
                secondary
                onClick={() => onCreate(someday ? "paused" : "active")}
              >
                {someday ? "Save an idea" : "Create a project"}
              </AddButton>
            )}
          </EmptyState>
        </section>
      ) : (
        <div className={`project-grid${someday ? " someday-grid" : ""}`}>
          {filtered.map((p) => (
            <article
              className={`card project-card accent-${data.areas.find((a) => a.id === p.area_id)?.accent ?? "slate"}`}
              key={p.id}
            >
              <div className="card-top">
                <AreaBadge area={data.areas.find((a) => a.id === p.area_id)} />
                <span className="status-label">
                  {someday ? "For later" : p.status}
                </span>
              </div>
              <h2>
                <button className="title-button" onClick={() => onEdit(p)}>
                  {p.title}
                </button>
              </h2>
              <div className="next-action">
                <span className="eyebrow">
                  {someday ? "A POSSIBILITY" : "NEXT ACTION"}
                </span>
                <p>
                  {p.next_action ||
                    "Give this project a next step when you're ready."}
                </p>
                {p.next_action && p.status === "active" && (
                  <button className="text-button" onClick={() => onPlan(p)}>
                    Plan this action <ArrowRight size={15} />
                  </button>
                )}
              </div>
              {p.target_date && (
                <div className="project-dates">
                  <CalendarDays size={15} aria-hidden="true" />
                  <span>Target {displayDate(p.target_date)}</span>
                </div>
              )}
              <div className="card-footer">
                <button className="text-button" onClick={() => onEdit(p)}>
                  <Pencil size={15} />
                  Edit
                </button>
                {p.status === "archived" || p.status === "paused" ? (
                  <button
                    className="text-button"
                    disabled={op.busy}
                    onClick={() => changeStatus(p, "active")}
                  >
                    <Play size={15} />
                    Make active
                  </button>
                ) : (
                  <button
                    className="text-button muted"
                    disabled={op.busy}
                    onClick={() => changeStatus(p, "archived")}
                  >
                    <Archive size={15} />
                    Archive
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
