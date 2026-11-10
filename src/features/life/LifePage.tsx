import type { Snapshot } from "../../domain/models";
import { areaCounts } from "../../domain/selectors";
import { AreaIcon, PageHeader } from "../../components/ui";

export function LifePage({ data, today }: { data: Snapshot; today: string }) {
  return (
    <>
      <PageHeader
        eyebrow="THE BIGGER PICTURE"
        title="The shape of your life."
        description="Different parts of one life. They don't all need your attention at once."
      />
      <div className="area-grid">
        {data.areas
          .filter((a) => !a.is_archived)
          .map((area) => {
            const counts = areaCounts(data, area.id, today);
            return (
              <article
                className={`area-card accent-${area.accent}`}
                key={area.id}
              >
                <AreaIcon area={area} />
                <div>
                  <h2>{area.name}</h2>
                  <p>
                    {counts.projects} active{" "}
                    {counts.projects === 1 ? "project" : "projects"}
                  </p>
                  <p>
                    {counts.wins} {counts.wins === 1 ? "Win" : "Wins"} · last 30
                    days
                  </p>
                </div>
              </article>
            );
          })}
      </div>
      <p className="page-footnote">
        A map of what you've recorded. There is no perfect balance.
      </p>
    </>
  );
}
