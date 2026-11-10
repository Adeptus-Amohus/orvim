import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import type { DailyCheckin } from "../../domain/models";
import type { Workspace } from "../../application/useWorkspace";
import { repository } from "../../data/repository";
import { ErrorNotice, Field, useOperation } from "../../components/ui";

export function Checkin({
  checkin,
  today,
  mutate,
  notify,
}: {
  checkin: DailyCheckin | undefined;
  today: string;
  mutate: Workspace["mutate"];
  notify: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [mood, setMood] = useState(checkin?.mood?.toString() ?? "");
  const [energy, setEnergy] = useState(checkin?.energy?.toString() ?? "");
  const [stress, setStress] = useState(checkin?.stress?.toString() ?? "");
  const [sleep, setSleep] = useState(checkin?.sleep_minutes?.toString() ?? "");
  const [note, setNote] = useState(checkin?.note ?? "");
  const op = useOperation();
  function edit() {
    setMood(checkin?.mood?.toString() ?? "");
    setEnergy(checkin?.energy?.toString() ?? "");
    setStress(checkin?.stress?.toString() ?? "");
    setSleep(checkin?.sleep_minutes?.toString() ?? "");
    setNote(checkin?.note ?? "");
    setEditing(true);
  }
  return (
    <section className="card checkin-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A MOMENT FOR YOU</span>
          <h2>How's today feeling?</h2>
        </div>
        {checkin && !editing && (
          <span className="saved-label">
            <Check size={14} />
            Saved
          </span>
        )}
      </div>
      {!editing ? (
        checkin ? (
          <>
            <div className="checkin-values">
              {[
                ["Mood", checkin.mood],
                ["Energy", checkin.energy],
                ["Stress", checkin.stress],
              ].map(([name, value]) => (
                <div key={name}>
                  <span>{name}</span>
                  <strong>
                    {value ?? "—"}
                    {value !== null && <small>/10</small>}
                  </strong>
                </div>
              ))}
            </div>
            {checkin.sleep_minutes !== null && (
              <p className="muted">
                Sleep: {Math.floor(checkin.sleep_minutes / 60)}h{" "}
                {checkin.sleep_minutes % 60}m
              </p>
            )}
            {checkin.note && (
              <p className="checkin-note preserve-lines">{checkin.note}</p>
            )}
            <button className="text-button" onClick={edit}>
              <Pencil size={15} />
              Edit today's check-in
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Mood, energy, stress. Just notice where you are.
            </p>
            <button className="button secondary" onClick={edit}>
              Check in
            </button>
          </>
        )
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void op.run(async () => {
              await mutate(() =>
                repository.saveCheckin({
                  date: today,
                  mood: mood === "" ? null : Number(mood),
                  energy: energy === "" ? null : Number(energy),
                  stress: stress === "" ? null : Number(stress),
                  sleep_minutes: sleep === "" ? null : Number(sleep),
                  note: note || null,
                }),
              );
              setEditing(false);
              notify("Today's check-in saved.");
            });
          }}
        >
          <div className="checkin-inputs">
            {[
              { label: "Mood", value: mood, set: setMood, hint: "Low → high" },
              {
                label: "Energy",
                value: energy,
                set: setEnergy,
                hint: "Low → high",
              },
              {
                label: "Stress",
                value: stress,
                set: setStress,
                hint: "Low → high",
              },
            ].map((item) => (
              <Field key={item.label} label={item.label} hint={item.hint}>
                <select
                  value={item.value}
                  onChange={(e) => item.set(e.target.value)}
                >
                  <option value="">Skip</option>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} / 10
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <details className="checkin-details">
            <summary>
              Sleep & a note <span className="muted">(optional)</span>
            </summary>
            <div className="form-fields">
              <Field
                label="Sleep in minutes (optional)"
                hint="For example, 450 minutes is 7 hours 30 minutes."
              >
                <input
                  type="number"
                  min={0}
                  max={1440}
                  step={1}
                  inputMode="numeric"
                  placeholder="450"
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                />
              </Field>
              <Field label="A short note (optional)">
                <textarea
                  rows={2}
                  maxLength={5000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything you want to notice?"
                />
              </Field>
            </div>
          </details>
          <ErrorNotice message={op.error} />
          <div className="form-actions">
            <button
              type="button"
              className="text-button"
              disabled={op.busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button className="button primary" disabled={op.busy}>
              {op.busy ? "Saving…" : "Save check-in"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
