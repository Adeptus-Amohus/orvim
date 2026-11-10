import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { Snapshot, Task, TaskStatus } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { repository } from "../../data/repository";
import { displayDate } from "../../domain/dates";
import {
  Dialog,
  EmptyState,
  ErrorNotice,
  useOperation,
} from "../../components/ui";

export function ActionsDialog({
  data,
  mutate,
  onEdit,
  onClose,
}: {
  data: Snapshot;
  mutate: Workspace["mutate"];
  onEdit: (task: Task) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<TaskStatus>("open");
  const op = useOperation();
  const items = data.tasks.filter((t) => t.status === filter);
  const change = (task: Task, status: TaskStatus) => {
    void op.run(async () => {
      await mutate(() => repository.setTaskStatus(task.id, status));
    });
  };
  return (
    <Dialog title="Your actions" onClose={onClose} busy={op.busy} wide>
      <div className="tabs" role="group" aria-label="Action status">
        {(["open", "completed", "cancelled"] as const).map((status) => (
          <button
            key={status}
            aria-pressed={filter === status}
            className={filter === status ? "selected" : ""}
            onClick={() => setFilter(status)}
          >
            {status[0]?.toUpperCase()}
            {status.slice(1)}
          </button>
        ))}
      </div>
      <ErrorNotice message={op.error} />
      {items.length === 0 ? (
        <EmptyState
          kind="done"
          title={`No ${filter} actions`}
          description="Make room for one small next step."
        />
      ) : (
        <div className="action-list">
          {items.map((task) => (
            <div className="action-row" key={task.id}>
              <button
                className="icon-button"
                disabled={op.busy}
                aria-label={`${filter === "open" ? "Complete" : "Reopen"}: ${task.title}`}
                onClick={() =>
                  change(task, filter === "open" ? "completed" : "open")
                }
              >
                {filter === "open" ? (
                  <Check size={18} />
                ) : (
                  <RotateCcw size={18} />
                )}
              </button>
              <div className="grow">
                <button className="title-button" onClick={() => onEdit(task)}>
                  {task.title}
                </button>
                <small>
                  {task.scheduled_date
                    ? `Scheduled ${displayDate(task.scheduled_date)}`
                    : "Unscheduled"}
                  {task.due_date ? ` · Due ${displayDate(task.due_date)}` : ""}
                </small>
              </div>
              {filter === "open" && (
                <button
                  className="icon-button"
                  aria-label={`Cancel: ${task.title}`}
                  disabled={op.busy}
                  onClick={() => change(task, "cancelled")}
                >
                  <X size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
