import { useState } from "react";
import { repository } from "../../data/repository";
import type { Area, Project, ProjectStatus } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import {
  AreaSelect,
  Dialog,
  ErrorNotice,
  Field,
  FormActions,
  useOperation,
} from "../../components/ui";

export function ProjectForm({
  project,
  initialStatus,
  areas,
  mutate,
  onClose,
  notify,
}: {
  project: Project | null;
  initialStatus: ProjectStatus;
  areas: Area[];
  mutate: Workspace["mutate"];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [area, setArea] = useState(project?.area_id ?? "");
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status ?? initialStatus,
  );
  const [next, setNext] = useState(project?.next_action ?? "");
  const [target, setTarget] = useState(project?.target_date ?? "");
  const [review, setReview] = useState(project?.review_date ?? "");
  const op = useOperation();
  return (
    <Dialog
      title={project ? "Edit project" : "A new project"}
      onClose={onClose}
      busy={op.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void op.run(async () => {
            await mutate(() =>
              repository.saveProject({
                id: project?.id ?? null,
                title,
                description,
                area_id: area || null,
                status,
                next_action: next || null,
                target_date: target || null,
                review_date: review || null,
              }),
            );
            notify(project ? "Project updated." : "Your project has a place.");
            onClose();
          });
        }}
      >
        <div className="form-fields">
          <Field label="Project title">
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What would you like to move forward?"
            />
          </Field>
          <Field label="Description (optional)">
            <textarea
              rows={3}
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does done look like?"
            />
          </Field>
          <div className="form-grid">
            <Field label="Life Area">
              <AreaSelect areas={areas} value={area} onChange={setArea} />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                <option value="active">Active</option>
                <option value="paused">Paused / someday</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
          <Field
            label="Next action (optional)"
            hint="One small, concrete step."
          >
            <input
              maxLength={500}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="The very next thing you could do"
            />
          </Field>
          <div className="form-grid">
            <Field label="Target date (optional)">
              <input
                type="date"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>
            <Field label="Review date (optional)">
              <input
                type="date"
                value={review}
                onChange={(e) => setReview(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <ErrorNotice message={op.error} />
        <FormActions
          busy={op.busy}
          onCancel={onClose}
          label={project ? "Save changes" : "Create project"}
        />
      </form>
    </Dialog>
  );
}
