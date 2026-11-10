import { useState } from "react";
import type { Snapshot, Task } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { repository } from "../../data/repository";
import {
  AreaSelect,
  Dialog,
  ErrorNotice,
  Field,
  FormActions,
  useOperation,
} from "../../components/ui";

export function TaskForm({
  data,
  today,
  task,
  projectId,
  initialTitle,
  mutate,
  onClose,
  notify,
}: {
  data: Snapshot;
  today: string;
  task: Task | null;
  projectId: string | null;
  initialTitle: string;
  mutate: Workspace["mutate"];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? initialTitle);
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [project, setProject] = useState(task?.project_id ?? projectId ?? "");
  const [area, setArea] = useState(
    task?.area_id ??
      data.projects.find((p) => p.id === projectId)?.area_id ??
      "",
  );
  const [scheduled, setScheduled] = useState(
    task ? (task.scheduled_date ?? "") : today,
  );
  const [due, setDue] = useState(task?.due_date ?? "");
  const op = useOperation();
  return (
    <Dialog
      title={task ? "Edit action" : "One small action"}
      onClose={onClose}
      busy={op.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void op.run(async () => {
            await mutate(() =>
              repository.saveTask({
                id: task?.id ?? null,
                title,
                notes: notes || null,
                project_id: project || null,
                area_id: area || null,
                scheduled_date: scheduled || null,
                due_date: due || null,
              }),
            );
            notify(
              task ? "Action updated." : "Action saved. One step at a time.",
            );
            onClose();
          });
        }}
      >
        <div className="form-fields">
          <Field label="Action title">
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Something small and doable"
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              rows={2}
              maxLength={10000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <Field label="Project (optional)">
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">No project</option>
              {data.projects
                .filter((p) => p.status === "active" || p.id === project)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Life Area (optional)">
            <AreaSelect areas={data.areas} value={area} onChange={setArea} />
          </Field>
          <div className="form-grid">
            <Field label="Scheduled date (optional)">
              <input
                type="date"
                value={scheduled}
                onChange={(e) => setScheduled(e.target.value)}
              />
            </Field>
            <Field label="Due date (optional)">
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <ErrorNotice message={op.error} />
        <FormActions busy={op.busy} onCancel={onClose} label="Save action" />
      </form>
    </Dialog>
  );
}
