import { useState } from "react";
import type { Snapshot, Win } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { repository } from "../../data/repository";
import { dateKey } from "../../domain/dates";
import { monthlyWins } from "../../domain/selectors";
import {
  AddButton,
  ConfirmDelete,
  EmptyState,
  PageHeader,
} from "../../components/ui";
import { WinMonth } from "./WinMonth";

export function WinsPage({
  data,
  today,
  mutate,
  onAdd,
  notify,
}: {
  data: Snapshot;
  today: string;
  mutate: Workspace["mutate"];
  onAdd: () => void;
  notify: (message: string) => void;
}) {
  const [deleting, setDeleting] = useState<Win | null>(null);
  const groups = new Map<string, Win[]>();
  for (const win of data.wins) {
    const key = dateKey(new Date(win.occurred_at)).slice(0, 7);
    const group = groups.get(key) ?? [];
    group.push(win);
    groups.set(key, group);
  }
  const count = monthlyWins(data, today);
  return (
    <>
      <PageHeader
        eyebrow="YOUR ARCHIVE OF PROGRESS"
        title="Wins"
        description="Small steps. Meaningful moments. Good things, kept."
        action={<AddButton onClick={onAdd}>Record a Win</AddButton>}
      />
      <div className="wins-summary">
        <strong>{count}</strong>
        <span>{count === 1 ? "Win" : "Wins"} this month</span>
        <p>
          {count
            ? "More happened than you might remember."
            : "There is no minimum size for a Win."}
        </p>
      </div>
      {data.wins.length === 0 ? (
        <section className="card">
          <EmptyState
            kind="wins"
            title="The small things deserve a place"
            description="Something you finished, tried, or made time for. Save a moment you'd like to remember."
          >
            <AddButton secondary onClick={onAdd}>
              Record your first Win
            </AddButton>
          </EmptyState>
        </section>
      ) : (
        <div className="timeline">
          {[...groups]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([month, wins]) => (
              <WinMonth
                key={month}
                month={month}
                wins={wins}
                data={data}
                onDelete={setDeleting}
              />
            ))}
        </div>
      )}
      {deleting && (
        <ConfirmDelete
          title={deleting.title}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await mutate(() => repository.deleteWin(deleting.id));
            notify("Win deleted.");
          }}
        />
      )}
    </>
  );
}
