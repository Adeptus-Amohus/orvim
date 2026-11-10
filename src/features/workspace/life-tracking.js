import {
  lifeSettings,
  personalDay,
  lifeDayStart,
  stampLifeRecord,
  weightSeries,
  illnessOnDay,
} from "./life-tracking-model.js";
import { statsShift } from "./life-period.js";

export function installLifeTracking(ctx) {
  const { $, make, action, listen } = ctx;
  const data = () => ctx.extraState,
    prefs = () => lifeSettings(data()),
    today = () => personalDay(Date.now(), data());
  const overlays = [];
  function dialog(id, title) {
    const overlay = make("div", "overlay");
    overlay.id = id;
    overlay.hidden = true;
    const body = make("form", "dialog life-tracking-dialog"),
      head = make("div", "dialog-head");
    body.setAttribute("role", "dialog");
    body.setAttribute("aria-modal", "true");
    body.setAttribute("aria-labelledby", id + "-title");
    const h = make("h2", "", title);
    h.id = id + "-title";
    const close = action("×", ctx.closeDialog, "close");
    close.setAttribute("aria-label", "Закрыть");
    head.append(h, close);
    body.append(head);
    overlay.append(body);
    ctx.root.append(overlay);
    overlays.push(overlay);
    listen(overlay, "click", (e) => {
      if (e.target === overlay) ctx.closeDialog();
    });
    return body;
  }
  function field(host, label, id, type = "text", value = "") {
    const box = make("label", "field"),
      name = make("span", "", label),
      input = make(type === "select" ? "select" : "input");
    input.id = id;
    if (type !== "select") input.type = type;
    input.value = value;
    box.append(name, input);
    host.append(box);
    return input;
  }
  function toggle(host, label, id) {
    const box = make("label", "life-tracking-toggle"),
      input = make("input");
    input.type = "checkbox";
    input.id = id;
    box.append(input, make("span", "", label));
    host.append(box);
    return input;
  }
  function save(host, text = "Сохранить") {
    const button = make("button", "button button-primary", text);
    button.type = "submit";
    host.append(button);
  }
  function open(id) {
    ctx.openDialog(id);
    ctx.fitDialog();
  }
  function commit() {
    ctx.persistState();
    ctx.renderLife();
    ctx.refreshHomeStatus();
    render();
  }
  function remove(kind, id) {
    const list = data()[kind],
      item = list.find((r) => r.id === id);
    if (!item) return;
    list.splice(list.indexOf(item), 1);
    commit();
    ctx.notify("Запись удалена", () => {
      list.push(item);
      commit();
    });
  }
  const settings = dialog(
    "life-tracking-settings-dialog",
    "Дополнения питания",
  );
  settings.append(
    make(
      "p",
      "aux-note",
      "Калории учитываются всегда. Остальное — по желанию.",
    ),
  );
  const water = toggle(settings, "Вода", "track-water"),
    weight = toggle(settings, "Вес тела", "track-weight"),
    macros = toggle(settings, "Белки, жиры и углеводы", "track-macros");
  save(settings);
  const settingsButton = action(
    "Дополнения",
    () => {
      const p = prefs();
      water.checked = p.nutrition.water;
      macros.checked = p.nutrition.macros;
      weight.checked = p.weight;
      open("life-tracking-settings-dialog");
    },
    "text-button",
  );
  settingsButton.id = "life-tracking-settings";
  $("#life-food-view .life-panel-head").append(settingsButton);
  listen(settings, "submit", (e) => {
    e.preventDefault();
    data().lifePreferences = {
      ...prefs(),
      weight: weight.checked,
      nutrition: {
        water: water.checked,
        macros: macros.checked,
        calories: true,
        micronutrients: false,
      },
    };
    ctx.closeDialog();
    commit();
  });
  const dayDialog = dialog("personal-day-dialog", "Начало моего дня"),
    customDay = toggle(dayDialog, "Своё начало дня", "personal-day-enabled"),
    start = field(
      dayDialog,
      "День начинается в",
      "personal-day-start",
      "time",
      "00:00",
    ),
    dayHelp = make("p", "aux-note");
  dayDialog.append(dayHelp);
  save(dayDialog);
  const dayButton = action(
    "",
    () => {
      customDay.checked = prefs().personalDay.enabled;
      start.value = prefs().personalDay.start;
      explain();
      open("personal-day-dialog");
    },
    "settings-personal-day personal-day-settings",
  );
  dayButton.id = "personal-day-settings";
  const dayTitle = make("strong", "", "Мой день"),
    dayDescription = make("small", "aux-note"),
    dayCopy = make("span", "settings-card-copy"),
    dayIcon = make("i"),
    dayArrow = make("i");
  dayIcon.dataset.lucide = "sunrise";
  dayArrow.dataset.lucide = "chevron-right";
  dayIcon.setAttribute("aria-hidden", "true");
  dayArrow.setAttribute("aria-hidden", "true");
  dayCopy.append(dayTitle, dayDescription);
  dayButton.append(dayIcon, dayCopy, dayArrow);
  $("#settings-panel-data .settings-panel-title").after(dayButton);
  function explain() {
    start.disabled = !customDay.checked;
    dayHelp.textContent = customDay.checked
      ? "Учёт идёт от выбранного времени до того же времени завтра. Шаги с подключённых часов обновятся автоматически. Старые записи без времени сохранят свою дату."
      : "День начинается в полночь. Можно выбрать своё время, например 22:00.";
  }
  listen(customDay, "change", explain);
  listen(start, "input", explain);
  listen(dayDialog, "submit", (e) => {
    e.preventDefault();
    if (!dayDialog.reportValidity()) return;
    const old = lifeDayStart(data());
    data().lifePreferences = {
      ...prefs(),
      personalDay: {
        enabled: customDay.checked,
        start: start.value || "00:00",
      },
    };
    ctx.closeDialog();
    ctx.resetLifeToday?.();
    commit();
    if (old !== lifeDayStart(data())) void ctx.refreshPersonalDay?.();
  });

  const weightDialog = dialog("body-weight-dialog", "Вес тела"),
    weightPeriod = make("div", "life-tracking-period"),
    weightChart = make("div", "body-weight-chart"),
    weightList = make("div", "life-tracking-records");
  let days = 30,
    editingWeight = null;
  for (const [n, label] of [
    [30, "Месяц"],
    [90, "3 месяца"],
    [365, "Год"],
    [0, "Всё"],
  ]) {
    const b = action(
      label,
      () => {
        days = n;
        paintWeight();
      },
      "button",
    );
    b.dataset.weightPeriod = n;
    weightPeriod.append(b);
  }
  weightDialog.append(weightPeriod, weightChart);
  const weightDate = field(weightDialog, "День", "body-weight-date", "date"),
    kg = field(weightDialog, "Вес, кг", "body-weight-kg", "number");
  Object.assign(kg, {
    min: "1",
    max: "1000",
    step: "0.01",
    inputMode: "decimal",
    required: true,
  });
  weightDate.required = true;
  save(weightDialog);
  weightDialog.append(weightList);
  listen(weightDialog, "submit", (e) => {
    e.preventDefault();
    if (!weightDialog.reportValidity()) return;
    const row = data().weightLogs.find((r) => r.id === editingWeight);
    if (row && row.date !== weightDate.value) delete row.occurredAt;
    if (row)
      Object.assign(row, {
        date: weightDate.value,
        kg: Number(kg.value),
        personalDate: true,
      });
    else
      data().weightLogs.push(
        stampLifeRecord(
          { id: ctx.createId(), date: weightDate.value, kg: Number(kg.value) },
          data(),
          "weightLogs",
        ),
      );
    editingWeight = null;
    kg.value = "";
    commit();
    paintWeight();
  });
  function paintWeight() {
    const series = weightSeries(
      data(),
      days ? statsShift(today(), 1 - days) : null,
      today(),
    );
    weightChart.replaceChildren();
    weightPeriod
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.weightPeriod) === days),
        ),
      );
    weightChart.append(
      make(
        "p",
        "life-tracking-value",
        series.last === null ? "Пока нет записей" : series.last + " кг",
      ),
    );
    if (series.change !== null)
      weightChart.append(
        make(
          "small",
          "aux-note",
          (series.change > 0 ? "+" : "") +
            series.change +
            " кг за выбранный период",
        ),
      );
    if (series.points.length > 1) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
        path = document.createElementNS(svg.namespaceURI, "path");
      svg.setAttribute("viewBox", "0 0 340 130");
      svg.setAttribute("role", "img");
      svg.setAttribute(
        "aria-label",
        "Изменение веса: " +
          series.points.map((p) => p.date + " — " + p.kg + " кг").join(", "),
      );
      const min = series.points.reduce((n, p) => Math.min(n, p.kg), Infinity),
        max = series.points.reduce((n, p) => Math.max(n, p.kg), -Infinity),
        first = Date.parse(series.points[0].date),
        span = Date.parse(series.points.at(-1).date) - first;
      path.setAttribute(
        "d",
        series.points
          .map(
            (p, i) =>
              (i ? "L" : "M") +
              (12 + ((Date.parse(p.date) - first) / span) * 316) +
              " " +
              (108 - ((p.kg - min) / Math.max(0.1, max - min)) * 85),
          )
          .join(" "),
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "3");
      path.setAttribute("stroke-linejoin", "round");
      svg.append(path);
      weightChart.append(svg);
    }
    weightList.replaceChildren();
    const recent = data()
      .weightLogs.filter(
        (r) => !days || r.date >= statsShift(today(), 1 - days),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    for (const row of recent.slice(0, 60)) {
      const line = make("div", "life-tracking-row"),
        edit = action(
          ctx.shortDate(row.date) + " · " + row.kg + " кг",
          () => {
            editingWeight = row.id;
            weightDate.value = row.date;
            kg.value = row.kg;
            kg.focus();
          },
          "text-button",
        ),
        del = action(
          "Удалить",
          () => {
            remove("weightLogs", row.id);
            paintWeight();
          },
          "text-button",
        );
      line.append(edit, del);
      weightList.append(line);
    }
    if (recent.length > 60)
      weightList.append(
        make(
          "small",
          "aux-note",
          "Показаны последние 60 записей. График учитывает весь выбранный период.",
        ),
      );
  }
  function openWeight() {
    editingWeight = null;
    weightDate.value = today();
    kg.value = "";
    paintWeight();
    open("body-weight-dialog");
  }

  const sick = dialog("illness-dialog", "Болезнь и восстановление");
  const homeIllness = action("", openIllness, "button home-illness-button");
  homeIllness.id = "home-illness";
  homeIllness.setAttribute("aria-label", "Болезнь и восстановление");
  homeIllness.className = "time-health-open";
  const clock = $("#local-time");
  clock.replaceWith(homeIllness);
  homeIllness.append(clock);
  const healthCaption = make("small", "health-clock-caption", "Восстановление");
  $(".time-card").append(healthCaption);
  const emblem = make("span", "recovery-emblem");
  emblem.innerHTML =
    '<svg viewBox="0 0 40 24" width="32" height="24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M17 3h6v6h6v6h-6v6h-6v-6h-6V9h6z" stroke-linejoin="round"/><path d="M11 9H2l4 5h5M29 9h9l-4 5h-5M7 17h6m14 0h6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  sick.querySelector("h2").prepend(emblem);
  const sickStatus = make("p", "illness-status"),
    sickActions = make("div", "illness-actions"),
    sickStartNow = action(
      "Болею с сегодня",
      () => markIllness(false),
      "button button-primary",
    ),
    sickSkipDay = action(
      "Пропустить только сегодня",
      () => markIllness(true),
      "button",
    ),
    sickRecover = action("Я выздоровел", recoverToday, "button button-primary");
  sickStartNow.id = "illness-start-now";
  sickSkipDay.id = "illness-skip-today";
  sickRecover.id = "illness-recover";
  sickActions.append(sickStartNow, sickSkipDay, sickRecover);
  sick.append(sickStatus, sickActions);
  sick.append(
    make(
      "p",
      "aux-note",
      "Одна отметка для питания, сна, тренировок и шагов. Можно продолжать записи или пропустить учёт: дни болезни не считаются обычным невыполнением целей. Всё записанное сохраняется.",
    ),
  );
  let editingIllness = null;
  const sickDetails = make("details", "illness-period-details");
  sickDetails.append(make("summary", "", "Другие даты и история"));
  sick.append(sickDetails);
  const sickStart = field(sickDetails, "Начало", "illness-from", "date"),
    sickEnd = field(
      sickDetails,
      "Последний день болезни · необязательно",
      "illness-until",
      "date",
    ),
    sickNote = field(sickDetails, "Заметка · необязательно", "illness-note");
  sickStart.required = true;
  sickNote.maxLength = 2000;
  save(sickDetails, "Сохранить период");
  const sickError = make("p", "connection-status"),
    sickList = make("div", "life-tracking-records");
  sickError.setAttribute("role", "status");
  sickDetails.append(sickError, sickList);
  function markIllness(singleDay) {
    if (illnessOnDay(data().illnessLogs, today(), today())) return;
    const row = {
      id: ctx.createId(),
      date: today(),
      until: singleDay ? today() : null,
      note: "",
    };
    data().illnessLogs.push(row);
    data().lifePreferences = { ...prefs(), illness: true };
    ctx.closeDialog();
    commit();
    ctx.notify(
      singleDay ? "Сегодня можно пропустить учёт" : "Отмечен период болезни",
      () => {
        const rows = data().illnessLogs;
        const index = rows.findIndex((item) => item.id === row.id);
        if (index !== -1) rows.splice(index, 1);
        commit();
      },
    );
  }
  function recoverToday() {
    // Period ends inclusively: today's recovery remains an excused day.
    for (const row of data().illnessLogs)
      if (row.date <= today() && (!row.until || row.until > today()))
        row.until = today();
    commit();
    ctx.closeDialog();
    ctx.notify("Выздоровление отмечено. Сегодня ещё можно пропустить учёт.");
  }
  listen(sickStart, "change", () => {
    sickEnd.min = sickStart.value;
  });
  listen(sick, "submit", (e) => {
    e.preventDefault();
    sickError.textContent = "";
    if (!sick.reportValidity()) return;
    if (sickStart.value > today()) {
      sickError.textContent = "Начало болезни не может быть в будущем.";
      return;
    }
    const fields = {
      date: sickStart.value,
      until: sickEnd.value || null,
      note: sickNote.value.trim(),
    };
    const row = data().illnessLogs.find((r) => r.id === editingIllness);
    if (row) Object.assign(row, fields);
    else data().illnessLogs.push({ id: ctx.createId(), ...fields });
    editingIllness = null;
    sickStart.value = today();
    sickEnd.min = today();
    sickEnd.value = sickNote.value = "";
    commit();
    paintIllness();
  });
  function paintIllness() {
    const ongoing = data().illnessLogs.some(
        (row) => row.date <= today() && (!row.until || row.until > today()),
      ),
      marked = illnessOnDay(data().illnessLogs, today(), today());
    sickStatus.textContent = ongoing
      ? "Сейчас отмечен период болезни"
      : marked
        ? "Сегодня — день восстановления. Завтра обычный учёт."
        : "Как вы сегодня?";
    sickStartNow.hidden = sickSkipDay.hidden = marked;
    sickRecover.hidden = !ongoing;
    sickList.replaceChildren();
    for (const row of [...data().illnessLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60)) {
      const line = make("div", "life-tracking-row");
      line.append(
        action(
          ctx.shortDate(row.date) +
            " — " +
            (row.until ? ctx.shortDate(row.until) : "ещё болею"),
          () => {
            sickDetails.open = true;
            editingIllness = row.id;
            sickStart.value = row.date;
            sickEnd.value = row.until || "";
            sickEnd.min = row.date;
            sickNote.value = row.note || "";
          },
          "text-button",
        ),
      );
      if (!row.until)
        line.append(
          action(
            "Выздоровел",
            () => {
              row.until = today();
              commit();
              paintIllness();
            },
            "button",
          ),
        );
      line.append(
        action(
          "Удалить",
          () => {
            remove("illnessLogs", row.id);
            paintIllness();
          },
          "text-button",
        ),
      );
      sickList.append(line);
    }
  }
  function openIllness() {
    editingIllness = null;
    sickStart.value = today();
    sickEnd.value = sickNote.value = sickError.textContent = "";
    sickEnd.min = today();
    sickDetails.open = false;
    paintIllness();
    open("illness-dialog");
  }

  // Keep the food journal and all of its totals in a single panel. The manual
  // editor expands on demand rather than occupying an empty desktop column.
  const foodPanel = $("#food-log").closest("section"),
    manual = $("#food-entry-disclosure"),
    manualPanel = manual.closest("section"),
    foodActions = make("div", "food-journal-actions"),
    foodSummary = make("div", "food-journal-summary"),
    calorieDetails = make("details", "food-calorie-details");
  foodPanel.classList.add("food-journal-panel");
  manual.querySelector("summary").textContent = "+ Добавить вручную";
  manual.querySelector("h2").hidden = true;
  foodActions.append(
    $("#food-ai-open"),
    ...manual.querySelectorAll(".food-add-head > button"),
  );
  foodSummary.append($("#food-day-total"), $("#food-day-macros"));
  calorieDetails.append(make("summary", "", "Цель и статистика питания"));
  for (const id of ["food-balance", "food-month-average", "food-target"]) {
    const node = $("#" + id);
    calorieDetails.append(
      id === "food-target"
        ? node.closest("label")
        : node.closest(".life-data-line"),
    );
  }
  foodPanel
    .querySelector(".life-panel-head")
    .after(foodSummary, foodActions, manual);
  foodPanel.append(calorieDetails);
  manualPanel.remove();
  const nutritionNotice = make("p", "illness-section-notice");
  nutritionNotice.id = "food-illness-notice";
  foodSummary.before(nutritionNotice);
  const weightCard = action("", openWeight, "nutrition-weight-card");
  weightCard.id = "nutrition-weight";
  foodPanel.append(weightCard);

  function render() {
    const p = prefs(),
      day = $("#food-day").value || today();
    dayDescription.textContent =
      "Начало дня в " +
      (p.personalDay.enabled ? p.personalDay.start : "00:00") +
      " · питание, сон, шаги и тренировки";
    weightCard.hidden = !p.weight;
    const latestWeight = weightSeries(data());
    weightCard.textContent =
      "Вес · " +
      (latestWeight.last === null
        ? "добавить запись"
        : latestWeight.last + " кг · график и записи");
    renderHome();
    nutritionNotice.hidden = !illnessOnDay(data().illnessLogs, day, today());
    nutritionNotice.textContent =
      "Болезнь / восстановление · можно пропустить учёт. Еду и воду по-прежнему можно записывать.";
    $("#hydration-view").hidden =
      $("#life-food-view").hidden || !p.nutrition.water;
    for (const id of [
      "food-day-total",
      "food-target",
      "food-balance",
      "food-month-average",
    ]) {
      const node = $("#" + id);
      if (node)
        (id === "food-target"
          ? node.closest("label")
          : node.closest(".life-data-line") || node
        ).hidden = !p.nutrition.calories;
    }
    $("#food-day-macros").hidden = !p.nutrition.macros;
    calorieDetails.hidden = false;
    if (p.nutrition.calories && illnessOnDay(data().illnessLogs, day, today()))
      $("#food-balance").textContent =
        "Период болезни · выполнение цели не оценивается";
    if (p.nutrition.water && illnessOnDay(data().illnessLogs, day, today()))
      $("#water-status").textContent =
        "Период болезни · только фактическое количество";
    for (const [key, show] of [
      ["calories", p.nutrition.calories],
      ["protein", p.nutrition.macros],
      ["fat", p.nutrition.macros],
      ["carbs", p.nutrition.macros],
    ]) {
      const input = $("#food-" + key);
      input.closest("label").hidden = !show;
      input.disabled = !show;
    }
    $("#food-log")
      .querySelectorAll(".food-record-macros")
      .forEach((n) => {
        n.hidden = !p.nutrition.macros;
      });
    if (!p.nutrition.calories)
      $("#food-log")
        .querySelectorAll(".food-log-copy")
        .forEach((n, i) => {
          const rows = ctx.foodLogs.filter(
            (r) => ctx.lifeDay(r, "foodLogs") === day,
          );
          if (rows[i]) n.textContent = rows[i].name;
        });
    if (!p.nutrition.calories)
      $("#life-food-summary").textContent =
        ctx.foodLogs.filter((r) => ctx.lifeDay(r, "foodLogs") === today())
          .length + " записей";
    // Stored nutrients remain intact when their display is turned off.
  }
  function renderHome() {
    const marked = illnessOnDay(data().illnessLogs, today(), today());
    homeIllness.setAttribute("aria-pressed", String(marked));
    homeIllness.setAttribute(
      "aria-label",
      marked
        ? "Болезнь и восстановление: день без оценки целей"
        : "Болезнь и восстановление",
    );
    homeIllness.dataset.active = String(marked);
    healthCaption.hidden = !marked;
  }
  return {
    render,
    renderHome,
    rehydrate: render,
    dispose() {
      overlays.forEach((n) => n.remove());
      settingsButton.remove();
      dayButton.remove();
      weightCard.remove();
      homeIllness.remove();
    },
  };
}
