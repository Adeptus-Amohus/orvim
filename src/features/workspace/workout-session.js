import { setCompletionIcon } from "./completion-icon.js";
import { entryMeasurement } from "./training-model.js";
import { installRestTimer } from "./rest-timer.js";

export function installWorkoutSession(ctx, changed) {
  const { make, action, listen } = ctx;
  const labels = {
    "Прошлый результат": ["Previous result"],
    "Повторить результат": ["Use previous result"],
    Подходы: ["Sets"],
    Повторения: ["Repetitions"],
    "Отдых выключен": ["Rest timer off"],
    Отдых: ["Rest"],
    "Время отдыха закончилось": ["Rest finished"],
  };
  for (const [ru, [en]] of Object.entries(labels)) {
    ctx.translations[ru] = en;
  }
  const t = (ru, en) => ctx.translate(ru, en || labels[ru]?.[0] || ru);
  const restTimer = installRestTimer(ctx);
  const beginRest = (workout) => restTimer.beginRest(workout);
  function previous(workout, entry) {
    return ctx
      .snapshotData()
      .workouts.filter(
        (item) =>
          item.trainingKey !== workout.trainingKey &&
          item.date + "T" + item.time <= workout.date + "T" + workout.time,
      )
      .flatMap((item) =>
        (item.entries || [])
          .filter(
            (e) =>
              e.exerciseKey === entry.exerciseKey &&
              e.unit === entry.unit &&
              (item.done || e.done || e.setResults?.some((s) => s.done)) &&
              Number.isFinite(e.value),
          )
          .map((e) => ({ workout: item, entry: e })),
      )
      .sort(
        (a, b) =>
          (b.workout.date + b.workout.time).localeCompare(
            a.workout.date + a.workout.time,
          ) ||
          (b.workout.completedAt || b.workout.id) -
            (a.workout.completedAt || a.workout.id),
      )[0]?.entry;
  }
  function resolve(workout, entry) {
    const current = ctx
      .snapshotData()
      .workouts.find((item) => item.trainingKey === workout.trainingKey);
    return {
      current,
      selected: current?.entries?.find(
        (item) => item.exerciseKey === entry.exerciseKey,
      ),
    };
  }
  function ensureSets(workout, entry) {
    if (!entry.setResults)
      entry.setResults = Array.from({ length: entry.sets || 1 }, () => ({
        value: Number.isFinite(entry.value) ? entry.value : null,
        done: Boolean(workout.done || entry.done),
        ...(workout.done || entry.done
          ? {
              completedAt:
                entry.completedAt || workout.completedAt || Date.now(),
            }
          : {}),
      }));
    while (entry.setResults.length < (entry.sets || 1))
      entry.setResults.push({ value: null, done: false });
    return entry.setResults;
  }
  function append(row, workout, entry) {
    const last = previous(workout, entry),
      copy = row.querySelector(".training-inline-name");
    if (last) {
      copy.append(
        make(
          "small",
          "training-previous",
          t("Прошлый результат") + ": " + last.value + " " + entry.unit,
        ),
      );
      const input = row.querySelector(".training-inline-value");
      input.placeholder = String(last.value);
      const use = action(
        "Повторить результат",
        () => {
          const { current, selected } = resolve(workout, entry);
          if (!selected) return;
          selected.value = last.value;
          if (selected.setResults)
            for (const [index, set] of selected.setResults.entries()) {
              const prior = last.setResults?.[index];
              set.value = prior?.value ?? last.value;
              if (prior?.reps !== undefined) set.reps = prior.reps;
            }
          if (selected.setResults?.some((set) => set.done))
            selected.value = entryMeasurement(selected);
          changed(current, false);
        },
        "text-button training-use-previous",
      );
      copy.append(use);
    }
    if ((entry.sets || 1) < 2 && entry.unit !== "кг") return;
    const details = make("details", "training-set-details experience-details");
    details.append(make("summary", "", "Подходы"));
    const counts = entry.setResults
      ? entry.setResults.filter((set) => set.done).length
      : entry.done || workout.done
        ? entry.sets
        : 0;
    details.querySelector("summary").textContent =
      t("Подходы") + " · " + counts + " / " + entry.sets;
    details.open =
      ctx.extraState.uiPreferences.openWorkoutSets ===
      workout.trainingKey + ":" + entry.exerciseKey;
    listen(details, "toggle", () => {
      if (details.open)
        ctx.extraState.uiPreferences.openWorkoutSets =
          workout.trainingKey + ":" + entry.exerciseKey;
    });
    for (let index = 0; index < entry.sets; index++) {
      const point = entry.setResults?.[index],
        setRow = make("div", "training-set-row");
      const input = make("input");
      Object.assign(input, {
        type: "number",
        min: "0",
        max: "100000",
        step: entry.unit === "раз" ? "1" : "0.1",
        inputMode: entry.unit === "раз" ? "numeric" : "decimal",
        value: point?.value ?? "",
        placeholder: String(
          last?.setResults?.[index]?.value ??
            entry.plannedValue ??
            last?.value ??
            "Факт",
        ),
      });
      input.setAttribute(
        "aria-label",
        entry.name +
          " · " +
          t("Подходы") +
          " " +
          (index + 1) +
          " · " +
          entry.unit,
      );
      const check = action(
        "",
        () => {
          if (input.validity.badInput || !input.reportValidity()) return;
          const { current, selected } = resolve(workout, entry);
          if (!selected) return;
          const sets = ensureSets(current, selected),
            set = sets[index];
          set.done = !set.done;
          if (set.done) {
            set.value =
              input.value === ""
                ? (selected.value ??
                  last?.setResults?.[index]?.value ??
                  selected.plannedValue ??
                  last?.value ??
                  null)
                : Number(input.value);
            set.completedAt = Date.now();
          } else delete set.completedAt;
          if (set.done && set.value === null) {
            set.done = false;
            input.focus();
            return;
          }
          const values = sets
            .filter((s) => s.done && Number.isFinite(s.value))
            .map((s) => s.value);
          selected.value = values.length ? Math.max(...values) : null;
          selected.done = sets.every((s) => s.done);
          if (values.length) selected.completedAt = Date.now();
          else delete selected.completedAt;
          current.done = current.entries.every((e) => e.done);
          changed(current, set.done);
          if (set.done) beginRest(current);
        },
        "task-check",
      );
      const done = point?.done ?? Boolean(workout.done || entry.done);
      setCompletionIcon(check, done);
      check.setAttribute(
        "aria-label",
        (done
          ? t("Вернуть подход", "Undo set")
          : t("Завершить подход", "Complete set")) +
          " " +
          (index + 1),
      );
      const commit = () => {
        if (input.validity.badInput || !input.checkValidity()) return;
        const { current, selected } = resolve(workout, entry);
        if (!selected) return;
        const sets = ensureSets(current, selected);
        sets[index].value = input.value === "" ? null : Number(input.value);
        if (sets[index].value === null && sets[index].done) {
          sets[index].done = false;
          delete sets[index].completedAt;
        }
        const actual = sets
          .filter((s) => s.done && Number.isFinite(s.value))
          .map((s) => s.value);
        selected.value = actual.length ? Math.max(...actual) : null;
        selected.done = sets.every((s) => s.done);
        current.done = current.entries.every((e) => e.done);
        changed(current, false, true);
      };
      listen(input, "change", commit);
      listen(input, "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      setRow.append(check, make("small", "", String(index + 1)), input);
      if (entry.unit === "кг") {
        const reps = make("input");
        Object.assign(reps, {
          type: "number",
          min: "0",
          max: "100000",
          step: "1",
          inputMode: "numeric",
          value: point?.reps ?? "",
          placeholder: t("Повторения"),
        });
        reps.setAttribute(
          "aria-label",
          entry.name + " · " + t("Повторения") + " " + (index + 1),
        );
        listen(reps, "change", () => {
          if (!reps.checkValidity() || reps.validity.badInput) return;
          const { current, selected } = resolve(workout, entry);
          if (!selected) return;
          const set = ensureSets(current, selected)[index];
          if (reps.value === "") delete set.reps;
          else set.reps = Number(reps.value);
          ctx.persistState();
        });
        setRow.append(reps);
      } else setRow.append(make("small", "", entry.unit));
      details.append(setRow);
    }
    row.append(details);
  }
  function appendEffort(host, workout) {
    if (!workout.done) return;
    const effort = make("details", "workout-effort"),
      options = make("div", "workout-effort-options");
    const names = [
      ["Очень легко", "Very easy"],
      ["Легко", "Easy"],
      ["Нормально", "Moderate"],
      ["Тяжело", "Hard"],
      ["Очень тяжело", "Very hard"],
    ];
    effort.dataset.workoutEffort = workout.trainingKey;
    effort.append(
      make(
        "summary",
        "",
        workout.effort
          ? t("Сложность тренировки", "Workout effort") +
              " · " +
              t(...names[workout.effort - 1])
          : t("Оценить тренировку · необязательно", "Rate workout · optional"),
      ),
      options,
    );
    function rate(value) {
      const current = ctx
        .snapshotData()
        .workouts.find((item) => item.trainingKey === workout.trainingKey);
      if (!current || !current.done) return;
      if (value === null) {
        delete current.effort;
        delete current.effortRatedAt;
      } else {
        current.effort = value;
        current.effortRatedAt = Date.now();
      }
      changed(current, false);
    }
    for (const [index, label] of names.entries()) {
      const choose = action(t(...label), () => rate(index + 1), "button");
      choose.setAttribute("aria-pressed", String(workout.effort === index + 1));
      options.append(choose);
    }
    if (workout.effort)
      options.append(
        action(
          t("Убрать оценку", "Remove rating"),
          () => rate(null),
          "text-button",
        ),
      );
    host.append(effort);
  }
  return {
    append,
    appendEffort,
    beginRest,
    attachTimer: restTimer.attach,
    timerSettings: restTimer.settings,
    dispose() {
      restTimer.dispose();
    },
  };
}
