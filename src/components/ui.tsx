import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Archive,
  Brain,
  BriefcaseBusiness,
  Check,
  Compass,
  Folder,
  Heart,
  House,
  Inbox,
  Leaf,
  Plus,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { Area } from "../domain/models";
import { errorMessage } from "../application/useWorkspace";

const areaIcons = {
  brain: Brain,
  heart: Heart,
  wallet: Wallet,
  users: Users,
  briefcase: BriefcaseBusiness,
  sprout: Leaf,
  house: House,
  compass: Compass,
  folder: Folder,
};
export function AreaIcon({ area }: { area: Area }) {
  const Icon = areaIcons[area.icon as keyof typeof areaIcons] ?? Compass;
  return (
    <span className={`area-icon accent-${area.accent}`}>
      <Icon size={19} aria-hidden="true" />
    </span>
  );
}
export function AreaBadge({ area }: { area: Area | undefined }) {
  return area ? (
    <span className={`area-badge accent-${area.accent}`}>
      <span className="color-dot" />
      {area.name}
    </span>
  ) : null;
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function AddButton({
  children,
  onClick,
  secondary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      className={secondary ? "button secondary" : "button primary"}
      onClick={onClick}
    >
      <Plus size={17} aria-hidden="true" />
      {children}
    </button>
  );
}
export function EmptyState({
  title,
  description,
  kind = "inbox",
  children,
}: {
  title: string;
  description: string;
  kind?: "inbox" | "projects" | "wins" | "done";
  children?: ReactNode;
}) {
  const Icon = { inbox: Inbox, projects: Archive, wins: Sparkles, done: Check }[
    kind
  ];
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorNotice({ message }: { message: string | null }) {
  return message ? (
    <p className="error-notice" role="alert">
      {message}
    </p>
  ) : null;
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const hintId = useId();
  const control =
    hint && isValidElement<{ "aria-describedby"?: string }>(children)
      ? cloneElement(children, {
          "aria-describedby": [children.props["aria-describedby"], hintId]
            .filter(Boolean)
            .join(" "),
        })
      : children;
  return (
    <label className="field">
      <span>{label}</span>
      {control}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}
export function AreaSelect({
  areas,
  value,
  onChange,
}: {
  areas: Area[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No area</option>
      {areas
        .filter((a) => !a.is_archived || a.id === value)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
    </select>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  busy = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    el?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FormActions({
  busy,
  onCancel,
  label = "Save",
}: {
  busy: boolean;
  onCancel: () => void;
  label?: string;
}) {
  return (
    <div className="form-actions">
      <button
        type="button"
        className="button secondary"
        onClick={onCancel}
        disabled={busy}
      >
        Cancel
      </button>
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}
export function useOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  async function run(action: () => Promise<void>): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export function ConfirmDelete({
  title,
  onDelete,
  onClose,
}: {
  title: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const op = useOperation();
  return (
    <Dialog title="Delete this item?" onClose={onClose} busy={op.busy}>
      <p className="dialog-description">
        “{title}” will be permanently removed from this device.
      </p>
      <ErrorNotice message={op.error} />
      <div className="form-actions">
        <button
          className="button secondary"
          onClick={onClose}
          disabled={op.busy}
        >
          Keep item
        </button>
        <button
          className="button danger"
          disabled={op.busy}
          onClick={() => {
            void op.run(async () => {
              await onDelete();
              onClose();
            });
          }}
        >
          {op.busy ? "Deleting…" : "Delete item"}
        </button>
      </div>
    </Dialog>
  );
}
