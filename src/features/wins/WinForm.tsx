import { useState } from "react";
import type { Snapshot } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { repository } from "../../data/repository";
import { atLocalNoon } from "../../domain/dates";
import {
  AreaSelect,
  Dialog,
  ErrorNotice,
  Field,
  FormActions,
  useOperation,
} from "../../components/ui";

export function WinForm({
  data,
  today,
  mutate,
  onClose,
  notify,
}: {
  data: Snapshot;
  today: string;
  mutate: Workspace["mutate"];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [area, setArea] = useState("");
  const [project, setProject] = useState("");
  const [date, setDate] = useState(today);
  const op = useOperation();
  return (
    <Dialog
      title="Something worth remembering"
      onClose={onClose}
      busy={op.busy}
    >
      <p className="dialog-description">
        A small step, a meaningful moment, or something you're proud of. It all
        counts.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void op.run(async () => {
            await mutate(() =>
              repository.addWin({
                title,
                note: note || null,
                area_id: area || null,
                project_id: project || null,
                task_id: null,
                occurred_at: atLocalNoon(date),
              }),
            );
            notify("A moment worth keeping. Win recorded.");
            onClose();
          });
        }}
      >
        <div className="form-fields">
          <Field label="What was your Win?">
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="I made time for…"
            />
          </Field>
          <Field label="A little more about it (optional)">
            <textarea
              rows={3}
              maxLength={10000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why did it matter to you?"
            />
          </Field>
          <div className="form-grid">
            <Field label="Life Area (optional)">
              <AreaSelect areas={data.areas} value={area} onChange={setArea} />
            </Field>
            <Field label="When did it happen?">
              <input
                required
                type="date"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Related project (optional)">
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">No project</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorNotice message={op.error} />
        <FormActions busy={op.busy} onCancel={onClose} label="Keep this Win" />
      </form>
    </Dialog>
  );
}
