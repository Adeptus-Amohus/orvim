import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { Page, Project, Snapshot, Task } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { mainActions } from "../../domain/selectors";
import { dateKey, displayDate } from "../../domain/dates";
import { repository } from "../../data/repository";
import {
  AddButton,
  AreaBadge,
  EmptyState,
  ErrorNotice,
  PageHeader,
  useOperation,
} from "../../components/ui";
import { Checkin } from "./Checkin";

export function NowPage({
  data,
  today,
  mutate,
  navigate,
  onTask,
  onEditTask,
  onActions,
  onWin,
  onProject,
  onPlan,
  notify,
}: {
  data: Snapshot;
  today: string;
  mutate: Workspace["mutate"];
  navigate: (page: Page) => void;
  onTask: () => void;
  onEditTask: (task: Task) => void;
  onActions: () => void;
  onWin: () => void;
  onProject: (project: Project) => void;
  onPlan: (project: Project) => void;
  notify: (message: string) => void;
}) {
  const actions = mainActions(data, today);
  const projects = data.projects.filter((p) => p.status === "active");
  const win = data.wins.find((w) => dateKey(new Date(w.occurred_at)) <= today);
  const op = useOperation();
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning."
      : hour < 18
        ? "Good afternoon."
        : "Good evening.";
  return (
    <>
      <PageHeader
        eyebrow={displayDate(today, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title={greeting}
        description="You don't have to hold it all at once."
        action={
          <AddButton secondary onClick={() => navigate("inbox")}>
            Quick capture
          </AddButton>
        }
      />
      <div className="now-layout">
        <section className="card main-actions">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE DIRECTION</span>
              <h2>Today's focus</h2>
            </div>
            <span
              className="soft-count"
              aria-label={`${actions.length} of up to 3 actions`}
            >
              {actions.length} / 3
            </span>
          </div>
          <p className="muted">A few next steps. Room for the rest of life.</p>
          <ErrorNotice message={op.error} />
          {actions.length ? (
            <div className="action-list">
              {actions.map((task) => (
                <div className="action-row" key={task.id}>
                  <button
                    className="action-check"
                    disabled={op.busy}
                    aria-label={`Complete: ${task.title}`}
                    onClick={() => {
                      void op.run(async () => {
                        await mutate(() =>
                          repository.setTaskStatus(task.id, "completed"),
                        );
                        notify("Action complete. Take a breath.");
                      });
                    }}
                  >
                    <Check size={17} />
                  </button>
                  <div className="grow">
                    <button
                      className="title-button"
                      onClick={() => onEditTask(task)}
                    >
                      {task.title}
                    </button>
                    <small>
                      {data.projects.find((p) => p.id === task.project_id)
                        ?.title ??
                        data.areas.find((a) => a.id === task.area_id)?.name ??
                        "A personal action"}
                      {task.due_date && ` · Due ${displayDate(task.due_date)}`}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              kind="done"
              title="Start with one small thing"
              description="What would make today feel a little lighter?"
            />
          )}
          <div className="section-actions">
            <AddButton secondary onClick={onTask}>
              Add an action
            </AddButton>
            <button className="text-button" onClick={onActions}>
              All actions{" "}
              <span className="small-count">
                {data.tasks.filter((t) => t.status === "open").length}
              </span>
            </button>
          </div>
        </section>
        <Checkin
          key={today}
          checkin={data.checkins.find((c) => c.date === today)}
          today={today}
          mutate={mutate}
          notify={notify}
        />
        <section className="card now-projects">
          <div className="section-heading">
            <h2>Active directions</h2>
            <button
              className="text-button"
              onClick={() => navigate("projects")}
            >
              {projects.length} active <ArrowRight size={15} />
            </button>
          </div>
          {projects.length ? (
            <div className="project-summary-list">
              {projects.slice(0, 3).map((project) => (
                <div className="project-summary" key={project.id}>
                  <div>
                    <AreaBadge
                      area={data.areas.find((a) => a.id === project.area_id)}
                    />
                    <button
                      className="title-button"
                      onClick={() => onProject(project)}
                    >
                      {project.title}
                    </button>
                    <p>
                      {project.next_action ??
                        "A next step is waiting to be named."}
                    </p>
                  </div>
                  {project.next_action && (
                    <button
                      className="icon-button"
                      aria-label={`Plan next action for ${project.title}`}
                      title="Plan next action"
                      onClick={() => onPlan(project)}
                    >
                      <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              kind="projects"
              title="A direction, not a deadline"
              description="Give something that matters a next step."
            >
              <button
                className="text-button"
                onClick={() => navigate("projects")}
              >
                Explore projects <ArrowRight size={15} />
              </button>
            </EmptyState>
          )}
        </section>
        <section className="card latest-win">
          <div className="section-heading">
            <h2>
              <Sparkles size={19} aria-hidden="true" /> A recent Win
            </h2>
            <button className="text-button" onClick={() => navigate("wins")}>
              All Wins <ArrowRight size={15} />
            </button>
          </div>
          {win ? (
            <>
              <time dateTime={win.occurred_at}>
                {displayDate(win.occurred_at)}
              </time>
              <h3>{win.title}</h3>
              {win.note && <p className="preserve-lines">{win.note}</p>}
              <AreaBadge area={data.areas.find((a) => a.id === win.area_id)} />
            </>
          ) : (
            <>
              <h3>Some progress doesn't fit a checkbox.</h3>
              <p>
                Notice a moment you're glad happened. It deserves a place here.
              </p>
            </>
          )}
          <button className="text-button" onClick={onWin}>
            Record a Win <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </>
  );
}
