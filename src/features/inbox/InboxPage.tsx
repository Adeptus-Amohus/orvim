import { useRef, useState } from "react";
import { ArrowUp, Check, RotateCcw, Trash2 } from "lucide-react";
import { repository } from "../../data/repository";
import type { Snapshot, InboxItem } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { displayDate } from "../../domain/dates";
import {
  ConfirmDelete,
  EmptyState,
  ErrorNotice,
  PageHeader,
  useOperation,
} from "../../components/ui";

export function InboxPage({
  data,
  mutate,
  notify,
}: {
  data: Snapshot;
  mutate: Workspace["mutate"];
  notify: (message: string) => void;
}) {
  const [content, setContent] = useState("");
  const [processed, setProcessed] = useState(false);
  const [deleting, setDeleting] = useState<InboxItem | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const op = useOperation();
  const items = data.inbox_items.filter(
    (item) => Boolean(item.processed_at) === processed,
  );
  const pendingCount = data.inbox_items.filter(
    (item) => !item.processed_at,
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="GET IT OUT OF YOUR HEAD"
        title="Inbox"
        description="A thought, a reminder, a loose end. Give it a place to land."
      />
      <form
        className="capture-bar"
        onSubmit={(e) => {
          e.preventDefault();
          if (!content.trim()) return;
          void op.run(async () => {
            await mutate(() => repository.addInbox(content));
            setContent("");
            setProcessed(false);
            notify("Captured. You can let that thought go.");
            window.setTimeout(() => input.current?.focus(), 0);
          });
        }}
      >
        <input
          ref={input}
          autoFocus
          aria-label="Quick capture"
          aria-describedby="capture-hint"
          enterKeyHint="send"
          placeholder="What's on your mind?"
          maxLength={5000}
          value={content}
          disabled={op.busy}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.nativeEvent.isComposing)
              e.preventDefault();
          }}
        />
        <button
          className="button primary"
          aria-label="Capture thought"
          disabled={op.busy || !content.trim()}
          type="submit"
        >
          <ArrowUp size={18} />
          <span>Capture</span>
        </button>
      </form>
      <p className="input-hint" id="capture-hint">
        Enter to capture. Decide what comes next, later.
      </p>
      <ErrorNotice message={op.error} />
      <div className="tabs" role="group" aria-label="Inbox filter">
        <button
          className={!processed ? "selected" : ""}
          aria-pressed={!processed}
          onClick={() => setProcessed(false)}
        >
          To process <span>{pendingCount}</span>
        </button>
        <button
          className={processed ? "selected" : ""}
          aria-pressed={processed}
          onClick={() => setProcessed(true)}
        >
          Processed <span>{data.inbox_items.length - pendingCount}</span>
        </button>
      </div>
      <section
        className={`card item-list${processed ? " processed-list" : ""}`}
        aria-label={processed ? "Processed captures" : "Inbox items"}
      >
        {items.length === 0 ? (
          <EmptyState
            title={
              processed ? "Nothing processed yet" : "A little more headspace"
            }
            description={
              processed
                ? "Captured thoughts will appear here after you mark them processed."
                : "A clear space. Capture anything you want to come back to."
            }
          />
        ) : (
          items.map((item) => (
            <article className="inbox-row" key={item.id}>
              <button
                className="icon-button complete-button"
                disabled={op.busy}
                aria-label={`${processed ? "Restore" : "Mark processed"}: ${item.content}`}
                title={processed ? "Return to inbox" : "Mark processed"}
                onClick={() => {
                  void op.run(async () => {
                    await mutate(() =>
                      repository.processInbox(item.id, !processed),
                    );
                    notify(
                      processed
                        ? "Returned to your inbox."
                        : "Marked as processed.",
                    );
                  });
                }}
              >
                {processed ? <RotateCcw size={18} /> : <Check size={18} />}
              </button>
              <div className="grow">
                <p className={processed ? "muted" : ""}>{item.content}</p>
                <time dateTime={item.created_at}>
                  {displayDate(item.created_at, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <button
                className="icon-button"
                aria-label={`Delete: ${item.content}`}
                onClick={() => setDeleting(item)}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))
        )}
      </section>
      {deleting && (
        <ConfirmDelete
          title={deleting.content}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await mutate(() => repository.deleteInbox(deleting.id));
            notify("Inbox item deleted.");
          }}
        />
      )}
    </>
  );
}
