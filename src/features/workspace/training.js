import { dateFormat, numberFormat } from "./formatters.js";
import {
  activeGoals,
  dailySteps,
  goalState,
  localDate,
  mergeHealthData,
  normalizeTraining,
  trainingKey,
  trainingUnits,
  totalsGoal,
  entryMeasurement,
  plannedWorkoutEntries,
  workoutDates,
  validateTrainingData,
} from "./training-model.js";
import { installTrainingTranslations } from "./training-translations.js";
import { setCompletionIcon } from "./completion-icon.js";
import { installWorkoutSession } from "./workout-session.js";
import { installExerciseOrder } from "./exercise-order.js";
import { installStepHistory } from "./step-history.js";
import {
  lifeDayStart,
  workoutAdherence,
  matchingStepDays,
  timestampInPersonalDay,
} from "./life-tracking-model.js";
import { statsPeriod, statsShift, stepStatistics } from "./life-statistics.js";
import {
  workoutGroup,
  workoutBatchRows,
  removeWorkoutBatch,
  restoreWorkoutBatch,
  workoutUpdateRows,
  updateWorkoutPlans,
  undoWorkoutPlans,
} from "./workout-batch.js";

export function installTraining(ctx) {
  installTrainingTranslations(ctx);
  const { $, make, listen, action, root } = ctx;
  let disposed = false,
    busy = false,
    lastAttempt = 0,
    visibleRows = 40;
  let healthStatus = null,
    draft = null,
    exerciseReturn = null;
  const snapshot = () => ctx.snapshotData();
  const prefs = () => {
    const state = ctx.extraState.uiPreferences;
    state.healthConnect ||= {
      enabled: false,
      steps: true,
      sleep: true,
      workouts: true,
    };
    return state.healthConnect;
  };
  const today = () => ctx.personalDay();
  const shift = (date, days) => {
    const value = new Date(date + "T12:00:00");
    value.setDate(value.getDate() + days);
    return localDate(value);
  };
  const numeric = (label, id, min = 0, max = 100000, step = "0.1") => {
    const field = ctx.fieldControl(label, id, "number").field;
    const input = field.querySelector("input");
    Object.assign(input, {
      min: String(min),
      max: String(max),
      step,
      required: true,
      inputMode: step === "1" ? "numeric" : "decimal",
    });
    return field;
  };
  const field = (label, id, type = "text", required = true) => {
    const result = ctx.fieldControl(label, id, type).field;
    const input = result.querySelector("input");
    input.required = required;
    if (type === "text") input.maxLength = 150;
    return result;
  };
  const select = (label, id, options) => {
    const result = ctx.fieldControl(label, id, "", "select").field;
    const input = result.querySelector("select");
    for (const [value, title] of options) {
      const option = make("option", "", title);
      option.value = value;
      input.append(option);
    }
    return result;
  };
  const user = (node) => {
    node.dataset.userContent = "";
    return node;
  };
  const calculationLabel = (goal) =>
    goal.kind === "count"
      ? "Количество тренировок"
      : totalsGoal(goal)
        ? "Всего за период"
        : ["раз", "кг"].includes(goal.unit)
          ? "За один подход"
          : "За одно занятие";
  function icon(name) {
    const node = make("i");
    node.dataset.lucide = name;
    node.setAttribute("aria-hidden", "true");
    return node;
  }
  function iconAction(name, label, callback) {
    const button = action("", callback, "text-button training-icon-button");
    button.append(icon(name));
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    return button;
  }
  function refreshIcons() {
    ctx.services.refreshIcons();
    ctx.applyLanguage();
  }
  const actionsForm = dialog(
    "training-actions-dialog",
    "Действия с тренировкой",
  );
  const actionsList = make("div", "training-actions-list");
  actionsForm.append(actionsList);
  function showActions(actions) {
    actionsList.replaceChildren();
    for (const item of actions)
      actionsList.append(
        action(
          item.label,
          () => {
            ctx.closeDialog();
            item.run();
          },
          item.label === "Удалить" ? "button button-danger" : "button",
        ),
      );
    ctx.openDialog("training-actions-dialog");
  }
  function refresh() {
    render();
    ctx.renderTasks();
    ctx.renderCalendar();
    ctx.renderLife();
    ctx.refreshHomeStatus?.();
    ctx.renderWins();
    ctx.persistState();
  }
  function dismissTrainingDialog(id) {
    const returnTo = id === "exercise-edit-dialog" ? exerciseReturn : null;
    exerciseReturn = null;
    ctx.closeDialog();
    if (returnTo) returnTo(null);
  }
  function dialog(id, title) {
    const overlay = make("div", "overlay");
    overlay.id = id;
    overlay.hidden = true;
    const form = make("form", "dialog training-dialog");
    listen(form, "submit", (event) => event.preventDefault());
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    form.setAttribute("aria-labelledby", id + "-title");
    const head = make("div", "dialog-head");
    const heading = make("h2", "", title);
    heading.id = id + "-title";
    head.append(
      heading,
      action("×", () => dismissTrainingDialog(id), "close"),
    );
    form.append(head);
    overlay.append(form);
    root.append(overlay);
    listen(overlay, "click", (event) => {
      if (event.target === overlay) {
        dismissTrainingDialog(id);
      }
    });
    listen(form, "keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissTrainingDialog(id);
      }
    });
    return form;
  }
  function saveRow(form, label) {
    const row = make("div", "dialog-actions");
    row.append(
      action(
        "Отмена",
        () => dismissTrainingDialog(form.parentElement.id),
        "button",
      ),
    );
    const save = make("button", "button button-primary", label);
    save.type = "submit";
    row.append(save);
    form.append(row);
    return save;
  }
  normalizeTraining(snapshot());
  root.dataset.trainingVersion = "2";
  const host = make("div", "training-workspace");
  $("#life-training-view").prepend(host);
  const head = make("div", "training-toolbar");
  const heading = make("div");
  heading.append(
    make("h2", "", "Тренировки"),
    make("p", "aux-note", "План, упражнения и ваш прогресс"),
  );
  const toolbar = make("div", "training-actions");
  toolbar.append(
    action("Мои занятия", () => openTemplates(), "button"),
    action("Упражнения", () => openLibrary(), "button"),
    action("+ Запланировать", () => openWorkout(), "button button-primary"),
  );
  head.append(heading, toolbar);
  const activity = make("section", "panel training-activity");
  const activityHead = make("div", "panel-head");
  const stepsTitle = action(
    "",
    () => openStepStatistics(),
    "training-steps-title training-steps-open",
  );
  stepsTitle.id = "steps-statistics-open";
  stepsTitle.setAttribute("aria-label", "Статистика шагов за месяц и год");
  stepsTitle.append(
    icon("footprints"),
    make("h3", "", "Шаги"),
    icon("chevron-right"),
  );
  const stepDate = make("input");
  stepDate.id = "steps-date";
  stepDate.type = "date";
  stepDate.value = today();
  stepDate.setAttribute("aria-label", "Дата шагов");
  activityHead.append(
    stepsTitle,
    stepDate,
    action("Данные часов", openHealth, "text-button"),
  );
  const stepBody = make("div", "training-step-body"),
    stepTotal = make("button", "training-step-total");
  stepTotal.type = "button";
  const stepChart = make("div", "training-step-chart");
  const stepHistory = installStepHistory(ctx, stepChart, (day) => {
    stepDate.value = day;
    renderSteps();
  });
  stepBody.append(stepTotal, stepChart);
  const stepSource = make("p", "aux-note");
  activity.append(activityHead, stepBody, stepSource);
  listen(stepTotal, "click", openSteps);
  listen(stepDate, "change", () => renderSteps(true));
  const stepStatsForm = dialog(
      "training-step-stats-dialog",
      "Статистика шагов",
    ),
    statsModeField = select("Период", "steps-stats-mode", [
      ["month", "Месяц"],
      ["year", "Год"],
    ]),
    statsMonthField = field("Месяц", "steps-stats-month", "month"),
    statsYearField = numeric("Год", "steps-stats-year", 1900, 2200, "1"),
    statsFields = make("div", "field-row"),
    statsTotals = make("div", "steps-stat-totals"),
    statsCoverage = make("p", "aux-note"),
    statsGraph = make("div", "steps-stat-graph"),
    statsSelected = make("p", "steps-stat-selected");
  statsTotals.id = "steps-stats-totals";
  statsGraph.setAttribute("aria-label", "Шаги по периодам");
  statsFields.append(statsModeField, statsMonthField, statsYearField);
  stepStatsForm.append(
    statsFields,
    statsTotals,
    statsCoverage,
    statsGraph,
    statsSelected,
    make(
      "p",
      "aux-note",
      "Среднее считается по дням с записью. Дни без данных не считаются нулевыми.",
    ),
  );
  function openStepStatistics() {
    const date = stepDate.value || today();
    $("#steps-stats-mode").value = "month";
    $("#steps-stats-month").value = date.slice(0, 7);
    $("#steps-stats-year").value = date.slice(0, 4);
    renderStepStatistics();
    ctx.openDialog("training-step-stats-dialog");
  }
  function renderStepStatistics() {
    const yearMode = $("#steps-stats-mode").value === "year";
    statsGraph.dataset.mode = yearMode ? "year" : "month";
    statsMonthField.hidden = yearMode;
    statsYearField.hidden = !yearMode;
    const period = statsPeriod(
      yearMode ? "year" : "month",
      $(yearMode ? "#steps-stats-year" : "#steps-stats-month").value,
    );
    if (!period) {
      statsTotals.replaceChildren();
      statsGraph.replaceChildren();
      statsSelected.textContent = "Выберите корректный период.";
      return;
    }
    const result = stepStatistics(
        snapshot().stepLogs,
        period.from,
        period.until,
        snapshot(),
      ),
      format = (n) =>
        numberFormat(ctx.displayLocale(), {
          maximumFractionDigits: 0,
        }).format(n);
    statsTotals.replaceChildren();
    for (const [label, value] of [
      ["Всего шагов", format(result.total)],
      [
        "Среднее вне болезни",
        result.averageOutsideIllness === null
          ? "—"
          : format(result.averageOutsideIllness),
      ],
      ["Лучший день", result.best ? format(result.best.count) : "—"],
    ]) {
      const card = make("div", "steps-stat-value");
      card.append(make("small", "", label), make("strong", "", value));
      statsTotals.append(card);
    }
    statsCoverage.textContent =
      "Дней с данными: " +
      result.recordedDays +
      " / " +
      result.calendarDays +
      (result.illnessDays
        ? " · болезнь: " +
          result.illnessDays +
          ". Пропуски в эти дни не оцениваются."
        : "");
    statsGraph.replaceChildren();
    statsSelected.textContent = result.best
      ? "Лучший день: " +
        ctx.shortDate(result.best.date) +
        " · " +
        format(result.best.count)
      : "В этом периоде пока нет записей.";
    const points = [];
    if (yearMode)
      for (let month = 1; month <= 12; month++) {
        const key =
            period.from.slice(0, 4) + "-" + String(month).padStart(2, "0"),
          row = result.monthly.find((r) => r.month === key);
        points.push({
          key,
          label: dateFormat(ctx.displayLocale(), {
            month: "short",
          }).format(new Date(key + "-01T12:00:00")),
          count: row?.total ?? null,
        });
      }
    else
      for (
        let date = period.from;
        date <= period.until;
        date = statsShift(date, 1)
      )
        points.push({
          key: date,
          label: String(Number(date.slice(8))),
          count: result.daily.find((r) => r.date === date)?.count ?? null,
        });
    const max = Math.max(1, ...points.map((p) => p.count || 0));
    for (const point of points) {
      const button = action(
        "",
        () => {
          if (yearMode) {
            $("#steps-stats-mode").value = "month";
            $("#steps-stats-month").value = point.key;
            renderStepStatistics();
          } else
            statsSelected.textContent =
              ctx.shortDate(point.key) +
              " · " +
              (point.count === null
                ? "Нет записи"
                : format(point.count) + " шагов");
        },
        "steps-stat-point",
      );
      button.setAttribute(
        "aria-label",
        point.key +
          ": " +
          (point.count === null
            ? "Нет записи"
            : format(point.count) + " шагов"),
      );
      const track = make("span", "steps-stat-track"),
        bar = make("span", "steps-stat-bar");
      bar.style.height =
        point.count === null
          ? "0"
          : Math.max(2, (point.count / max) * 100) + "%";
      button.dataset.hasData = String(point.count !== null);
      track.append(bar);
      button.append(track, make("small", "", point.label));
      statsGraph.append(button);
    }
    refreshIcons();
  }
  for (const node of [
    statsModeField.querySelector("select"),
    statsMonthField.querySelector("input"),
    statsYearField.querySelector("input"),
  ])
    listen(node, "change", renderStepStatistics);
  const goalPanel = make("section", "panel training-goals");
  const goalHead = make("div", "panel-head");
  let goalsExpanded = false;
  const goalRing = make("span", "training-goal-ring", "0%"),
    goalSummaryCopy = make("span", "training-goal-copy"),
    goalSummaryNote = make("small", "aux-note"),
    goalChevron = icon("chevron-right"),
    goalToggle = action(
      "",
      () => {
        goalsExpanded = !goalsExpanded;
        goalToggle.setAttribute("aria-expanded", String(goalsExpanded));
        renderGoals();
        refreshIcons();
      },
      "training-goals-toggle",
    );
  goalSummaryCopy.append(
    make("strong", "", "Цели · общий прогресс"),
    goalSummaryNote,
  );
  goalToggle.append(goalRing, goalSummaryCopy, goalChevron);
  goalToggle.setAttribute("aria-expanded", "false");
  goalToggle.setAttribute("aria-controls", "training-goal-list");
  goalHead.append(
    goalToggle,
    action("+ Цель", () => openGoal(), "text-button"),
  );
  const goalList = make("div", "training-goal-grid");
  goalList.id = "training-goal-list";
  goalList.hidden = true;
  goalPanel.append(goalHead, goalList);
  const plan = make("section", "panel training-plan");
  const planHead = make("div", "panel-head");
  const month = make("input");
  month.type = "month";
  month.id = "training-plan-month";
  month.value = today().slice(0, 7);
  month.setAttribute("aria-label", "Месяц тренировок");
  const planCount = make("span", "aux-note");
  planHead.append(make("h3", "", "План и результаты"), planCount, month);
  const filters = make("div", "training-filters");
  let filter = "all";
  for (const [value, title] of [
    ["all", "Все"],
    ["planned", "Запланировано"],
    ["done", "Выполнено"],
  ]) {
    const button = action(
      title,
      () => {
        filter = value;
        visibleRows = 40;
        renderPlan();
      },
      "button",
    );
    button.dataset.trainingFilter = value;
    filters.append(button);
  }
  const planList = make("div", "training-plan-list");
  let trainingDay = today(),
    planScope = "day",
    dayScrollTimer = 0,
    dayAlignmentNeeded = true,
    dayDrag = null,
    suppressStripClickUntil = 0,
    daySwipe = null,
    suppressDayClickUntil = 0,
    planAnimation = null;
  const dayNavigation = make("div", "training-day-navigation"),
    dayDate = make("input"),
    dayStrip = make("div", "training-days");
  dayDate.type = "date";
  dayDate.id = "training-plan-date";
  dayDate.value = trainingDay;
  dayDate.setAttribute("aria-label", "Дата тренировок");
  dayStrip.id = "training-days";
  dayStrip.setAttribute("role", "group");
  dayStrip.setAttribute("aria-label", "Дни тренировок");
  const scopeButton = action(
    "Месяц",
    () => {
      planScope = planScope === "day" ? "month" : "day";
      renderPlan();
      if (planScope === "day") alignTrainingDay(false);
    },
    "button training-scope",
  );
  dayNavigation.append(
    iconAction("chevron-left", "Предыдущий день", () =>
      selectTrainingDay(shift(trainingDay, -1)),
    ),
    dayDate,
    action("Сегодня", () => selectTrainingDay(today()), "text-button"),
    iconAction("chevron-right", "Следующий день", () =>
      selectTrainingDay(shift(trainingDay, 1)),
    ),
    scopeButton,
  );
  plan.append(planHead, dayNavigation, dayStrip, filters, planList);
  function alignTrainingDay(smooth = true) {
    const button = dayStrip.querySelector(
      `[data-training-day="${trainingDay}"]`,
    );
    if (!button || !dayStrip.clientWidth) {
      dayAlignmentNeeded = true;
      return;
    }
    dayAlignmentNeeded = false;
    dayStrip.scrollTo({
      left:
        button.offsetLeft - dayStrip.clientWidth / 2 + button.offsetWidth / 2,
      behavior:
        smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
  }
  function paintTrainingDays() {
    dayDate.value = trainingDay;
    month.hidden = planScope !== "month";
    dayStrip.hidden = planScope !== "day";
    dayNavigation.querySelectorAll("button,input").forEach((node) => {
      if (node !== scopeButton) node.hidden = planScope !== "day";
    });
    scopeButton.textContent = planScope === "day" ? "Месяц" : "День";
    const selectedIndex = [...dayStrip.children].findIndex(
      (button) => button.dataset.trainingDay === trainingDay,
    );
    if (
      selectedIndex < 0 ||
      (!dayDrag &&
        (selectedIndex < 5 || selectedIndex > dayStrip.children.length - 6))
    ) {
      dayStrip.replaceChildren();
      const weekday = dateFormat(ctx.displayLocale(), {
        weekday: "short",
      });
      for (let index = -17; index <= 17; index++) {
        const key = shift(trainingDay, index),
          button = action("", () => selectTrainingDay(key), "training-day");
        button.dataset.trainingDay = key;
        button.append(
          make("small", "", weekday.format(new Date(key + "T12:00:00"))),
          make("strong", "", String(Number(key.slice(8)))),
        );
        dayStrip.append(button);
      }
      dayAlignmentNeeded = true;
    }
    const workouts = snapshot().workouts;
    const dayFormatter = dateFormat(ctx.displayLocale(), {
      weekday: "short",
    });
    dayStrip.querySelectorAll("[data-training-day]").forEach((button) => {
      const key = button.dataset.trainingDay,
        records = workouts.filter(
          (workout) => ctx.lifeDay(workout, "workouts") === key,
        );
      button.setAttribute("aria-pressed", String(key === trainingDay));
      button.querySelector("small").textContent = dayFormatter.format(
        new Date(key + "T12:00:00"),
      );
      button.setAttribute(
        "aria-label",
        ctx.shortDate(key) +
          ": " +
          records.length +
          " " +
          ctx.translate("тренировок", "workouts"),
      );
      button.dataset.activity = records.length
        ? records.every((w) => w.done)
          ? "done"
          : "planned"
        : "none";
    });
    if (dayAlignmentNeeded && planScope === "day") alignTrainingDay(false);
  }
  function selectTrainingDay(day, align = true) {
    if (!day) return;
    const direction = day > trainingDay ? 1 : day < trainingDay ? -1 : 0;
    trainingDay = day;
    planScope = "day";
    month.value = day.slice(0, 7);
    visibleRows = 40;
    stepDate.value = day;
    renderSteps();
    renderPlan();
    if (align) alignTrainingDay();
    if (
      direction &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      planAnimation?.cancel();
      planAnimation = planList.animate?.(
        [
          { opacity: 0.35, transform: `translateX(${direction * 22}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 210, easing: "cubic-bezier(.2,.7,.3,1)" },
      );
    }
  }
  listen(dayDate, "change", () => selectTrainingDay(dayDate.value));
  function nearestTrainingDay() {
    const center = dayStrip.scrollLeft + dayStrip.clientWidth / 2;
    return [...dayStrip.children].reduce(
      (best, node) =>
        !best ||
        Math.abs(node.offsetLeft + node.offsetWidth / 2 - center) <
          Math.abs(best.offsetLeft + best.offsetWidth / 2 - center)
          ? node
          : best,
      null,
    );
  }
  listen(dayStrip, "pointerdown", (event) => {
    // Android owns touch scrolling and inertia; mouse dragging is explicit.
    if (event.pointerType === "touch") return;
    if (event.button !== 0 || !dayStrip.clientWidth) return;
    window.clearTimeout(dayScrollTimer);
    dayDrag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: dayStrip.scrollLeft,
      moved: false,
    };
  });
  listen(dayStrip, "pointermove", (event) => {
    if (!dayDrag || event.pointerId !== dayDrag.id) return;
    const x = event.clientX - dayDrag.x,
      y = event.clientY - dayDrag.y;
    if (!dayDrag.moved && Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
      dayDrag = null;
      return;
    }
    if (!dayDrag.moved && Math.abs(x) > 7 && Math.abs(x) > Math.abs(y) * 1.3) {
      dayDrag.moved = true;
      dayStrip.classList.add("is-dragging");
      dayStrip.setPointerCapture(event.pointerId);
    }
    if (!dayDrag.moved) return;
    event.preventDefault();
    dayStrip.scrollLeft = dayDrag.left - x;
  });
  function finishStripDrag(event, cancelled = false) {
    if (!dayDrag || event.pointerId !== dayDrag.id) return;
    const moved = dayDrag.moved;
    dayDrag = null;
    dayStrip.classList.remove("is-dragging");
    if (dayStrip.hasPointerCapture?.(event.pointerId))
      dayStrip.releasePointerCapture(event.pointerId);
    if (!moved) return;
    suppressStripClickUntil = Date.now() + 450;
    const closest = nearestTrainingDay();
    if (!cancelled && closest) selectTrainingDay(closest.dataset.trainingDay);
    else alignTrainingDay();
  }
  listen(dayStrip, "pointerup", (event) => finishStripDrag(event));
  listen(dayStrip, "pointercancel", (event) => finishStripDrag(event, true));
  listen(dayStrip, "lostpointercapture", (event) =>
    finishStripDrag(event, true),
  );
  listen(
    dayStrip,
    "click",
    (event) => {
      if (Date.now() >= suppressStripClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
  listen(dayStrip, "keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    selectTrainingDay(shift(trainingDay, event.key === "ArrowRight" ? 1 : -1));
    dayStrip
      .querySelector(`[data-training-day="${trainingDay}"]`)
      ?.focus({ preventScroll: true });
  });
  listen(
    dayStrip,
    "scroll",
    () => {
      window.clearTimeout(dayScrollTimer);
      dayScrollTimer = window.setTimeout(() => {
        if (disposed || dayDrag || planScope !== "day" || !dayStrip.clientWidth)
          return;
        const closest = nearestTrainingDay();
        if (closest && closest.dataset.trainingDay !== trainingDay)
          selectTrainingDay(closest.dataset.trainingDay, false);
      }, 160);
    },
    { passive: true },
  );
  listen(
    dayStrip,
    "wheel",
    (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? dayStrip.clientWidth
            : 1);
      const room =
        delta < 0
          ? dayStrip.scrollLeft > 1
          : dayStrip.scrollLeft <
            dayStrip.scrollWidth - dayStrip.clientWidth - 1;
      if (!delta || !room) return;
      event.preventDefault();
      dayStrip.scrollLeft += delta;
    },
    { passive: false },
  );
  listen(planList, "pointerdown", (event) => {
    if (
      planScope !== "day" ||
      event.button !== 0 ||
      event.target.closest("button,input,textarea,select,a,[contenteditable]")
    )
      return;
    daySwipe = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  });
  listen(planList, "pointermove", (event) => {
    if (!daySwipe || daySwipe.id !== event.pointerId) return;
    const x = event.clientX - daySwipe.x,
      y = event.clientY - daySwipe.y;
    if (!daySwipe.moved && Math.abs(y) > 12 && Math.abs(y) >= Math.abs(x)) {
      daySwipe = null;
      return;
    }
    if (
      !daySwipe.moved &&
      Math.abs(x) > 14 &&
      Math.abs(x) > Math.abs(y) * 1.5
    ) {
      daySwipe.moved = true;
      planList.setPointerCapture(event.pointerId);
      planAnimation?.cancel();
    }
    if (!daySwipe.moved) return;
    event.preventDefault();
    planList.style.transform = `translateX(${Math.max(-90, Math.min(90, x * 0.6))}px)`;
  });
  function finishDaySwipe(event, cancelled = false) {
    if (!daySwipe || daySwipe.id !== event.pointerId) return;
    const gesture = daySwipe,
      delta = event.clientX - gesture.x;
    daySwipe = null;
    if (planList.hasPointerCapture(event.pointerId))
      planList.releasePointerCapture(event.pointerId);
    planList.style.transform = "";
    if (!gesture.moved) return;
    suppressDayClickUntil = Date.now() + 450;
    if (!cancelled && Math.abs(delta) >= 55)
      selectTrainingDay(shift(trainingDay, delta < 0 ? 1 : -1));
  }
  listen(planList, "pointerup", (event) => finishDaySwipe(event));
  listen(planList, "pointercancel", (event) => finishDaySwipe(event, true));
  listen(
    planList,
    "click",
    (event) => {
      if (Date.now() < suppressDayClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  host.append(head, plan, goalPanel, activity);
  const session = installWorkoutSession(ctx, (workout) => {
    updateCompletion(workout);
    refresh();
    paintQuickResults();
    if (!$("#training-results-dialog").hidden) renderResults(workout);
  });
  listen(month, "change", () => {
    if (!month.value) return;
    planScope = "month";
    if (!trainingDay.startsWith(month.value)) trainingDay = month.value + "-01";
    visibleRows = 40;
    renderPlan();
  });

  // Exercise library: a named, reusable exercise with a single measured unit.
  const libraryForm = dialog("exercise-library-dialog", "Мои упражнения");
  const librarySearch = make("input");
  librarySearch.type = "search";
  librarySearch.placeholder = "Найти упражнение";
  librarySearch.setAttribute("aria-label", "Найти упражнение");
  const libraryList = make("div", "exercise-library-list");
  libraryForm.append(
    action("+ Своё упражнение", () => openExercise(), "button button-primary"),
    librarySearch,
    libraryList,
  );
  listen(librarySearch, "input", renderLibrary);
  const exerciseForm = dialog("exercise-edit-dialog", "Упражнение");
  exerciseForm.append(
    field("Название", "exercise-new-name"),
    select(
      "Что измеряем",
      "exercise-new-unit",
      trainingUnits.map((unit) => [
        unit,
        unit === "раз"
          ? "Повторы · раз"
          : unit === "кг"
            ? "Вес · кг"
            : unit === "км"
              ? "Расстояние · км"
              : "Время · мин",
      ]),
    ),
    field("Описание · по желанию", "exercise-new-description", "text", false),
  );
  saveRow(exerciseForm, "Сохранить упражнение");
  let editingExercise = null;
  function openLibrary() {
    librarySearch.value = "";
    renderLibrary();
    ctx.openDialog("exercise-library-dialog");
  }
  function openExercise(exercise = null, returnToWorkout = false) {
    editingExercise = exercise;
    exerciseReturn =
      typeof returnToWorkout === "function"
        ? returnToWorkout
        : returnToWorkout
          ? () => {
              renderExercisePicker();
              ctx.openDialog("training-edit-dialog");
            }
          : null;
    $("#exercise-new-name").value = exercise?.name || "";
    $("#exercise-new-unit").value = exercise?.unit || "раз";
    $("#exercise-new-description").value = exercise?.description || "";
    // Units cannot change under existing measurements or goal links.
    $("#exercise-new-unit").disabled = Boolean(
      exercise &&
      (snapshot().workouts.some((w) =>
        w.entries?.some((entry) => entry.exerciseKey === exercise.exerciseKey),
      ) ||
        snapshot().trainingGoals.some(
          (goal) => goal.exerciseKey === exercise.exerciseKey,
        )),
    );
    ctx.openDialog("exercise-edit-dialog");
  }
  function renderLibrary() {
    const query = librarySearch.value.toLocaleLowerCase();
    libraryList.replaceChildren();
    const items = snapshot().exercises.filter((e) =>
      e.name.toLocaleLowerCase().includes(query),
    );
    if (!items.length)
      libraryList.append(
        make("p", "aux-note", "Добавьте своё упражнение или выберите пример."),
      );
    for (const exercise of items.slice(0, 200)) {
      const row = make("div", "exercise-library-row");
      const copy = make("div");
      copy.append(
        user(make("strong", "", exercise.name)),
        make("small", "aux-note", exercise.unit),
        user(make("p", "aux-note", exercise.description || "")),
      );
      row.append(
        copy,
        iconAction("pencil", "Изменить упражнение", () =>
          openExercise(exercise),
        ),
        iconAction("trash-2", "Удалить упражнение", () =>
          ctx.removeWithUndo(snapshot().exercises, exercise, () => {
            renderLibrary();
            render();
          }),
        ),
      );
      libraryList.append(row);
    }
    if (!snapshot().exercises.length) {
      const samples = make("div", "training-actions");
      for (const [name, unit] of [
        ["Подтягивания", "раз"],
        ["Приседания", "кг"],
        ["Бег", "км"],
      ])
        samples.append(
          action(
            "+ " + name,
            () => {
              openExercise();
              $("#exercise-new-name").value = name;
              $("#exercise-new-unit").value = unit;
            },
            "button",
          ),
        );
      libraryList.append(samples);
    }
    refreshIcons();
  }
  listen(exerciseForm, "submit", (event) => {
    event.preventDefault();
    if (!exerciseForm.reportValidity()) return;
    const values = {
      name: $("#exercise-new-name").value.trim(),
      unit: $("#exercise-new-unit").value,
      description: $("#exercise-new-description").value.trim(),
    };
    if (!values.name) return;
    const duplicate = snapshot().exercises.find(
      (e) =>
        e !== editingExercise &&
        e.name.toLocaleLowerCase() === values.name.toLocaleLowerCase() &&
        e.unit === values.unit,
    );
    if (duplicate) {
      ctx.notify("Такое упражнение уже есть в списке.");
      return;
    }
    let savedExercise = editingExercise;
    if (savedExercise) Object.assign(savedExercise, values);
    else {
      savedExercise = {
        id: ctx.createId(),
        exerciseKey: trainingKey(),
        duration: 15,
        ...values,
      };
      snapshot().exercises.push(savedExercise);
    }
    const returnTo = exerciseReturn;
    exerciseReturn = null;
    ctx.closeDialog();
    refresh();
    if (returnTo) returnTo(savedExercise);
    else openLibrary();
  });

  // Planning and structural edits stay separate from one-click completion.
  const workoutForm = dialog("training-edit-dialog", "Тренировка");
  const nameField = field("Название тренировки", "workout-title");
  const when = make("div", "field-row");
  when.append(
    field("Дата в расписании", "workout-date", "date"),
    field("Начало", "workout-time", "time"),
  );
  const durationField = numeric(
    "Длительность · мин",
    "workout-duration",
    1,
    1439,
    "1",
  );
  const restField = make("div", "workout-rest-setting");
  restField.append(make("span", "", "Отдых между подходами"));
  session.attachTimer(restField, () => draft, false);
  const pickerRow = make("div", "training-exercise-picker");
  const pickerField = select("Упражнения", "workout-exercise-picker", []);
  pickerRow.append(
    pickerField,
    action(
      "Добавить",
      () => {
        const exercise = snapshot().exercises.find(
          (e) => e.exerciseKey === $("#workout-exercise-picker").value,
        );
        addDraftExercise(exercise);
      },
      "button",
    ),
  );
  const draftEntries = make("div", "workout-draft-entries");
  installExerciseOrder(
    ctx,
    draftEntries,
    () => draft?.entries || [],
    renderDraftEntries,
  );
  const customExercise = action(
    "+ Своё упражнение",
    () =>
      openExercise(null, (exercise) => {
        renderExercisePicker();
        if (exercise) addDraftExercise(exercise);
        ctx.openDialog("training-edit-dialog");
      }),
    "text-button",
  );
  const goalsField = make("fieldset", "workout-linked-goals");
  const goalsLegend = make("legend", "", "Связанные цели");
  const draftGoals = make("div");
  goalsField.append(goalsLegend, draftGoals);
  const repeatField = select("Повтор", "workout-repeat", [
    ["1", "Один раз"],
    ["4", "Еженедельно · месяц"],
    ["13", "Еженедельно · 3 месяца"],
    ["26", "Еженедельно · 6 месяцев"],
    ["52", "Еженедельно · год"],
    ["interval", "Каждые N дней"],
  ]);
  const repeatInterval = make("div", "field-row workout-repeat-interval");
  repeatInterval.append(
    numeric("Раз в · дней", "workout-repeat-days", 1, 365, "1"),
    field("До даты включительно", "workout-repeat-until", "date"),
  );
  repeatInterval.hidden = true;
  const repeatPreview = make("p", "aux-note workout-repeat-preview");
  repeatPreview.setAttribute("aria-live", "polite");
  repeatPreview.hidden = true;
  const noteField = field(
    "Заметка · по желанию",
    "workout-note",
    "text",
    false,
  );
  const doneLabel = make("label", "training-check-label");
  const doneControl = make("input");
  doneControl.type = "checkbox";
  doneControl.id = "workout-done";
  doneLabel.append(doneControl, make("span", "", "Тренировка выполнена"));
  const saveTemplateLabel = make("label", "training-check-label"),
    saveTemplateControl = make("input");
  saveTemplateControl.type = "checkbox";
  saveTemplateControl.id = "workout-save-template";
  saveTemplateLabel.append(
    saveTemplateControl,
    make("span", "", "Сохранить в «Мои занятия»"),
  );
  const editorError = make("p", "error");
  const updatePlansLabel = make("label", "training-check-label"),
    updatePlansControl = make("input");
  updatePlansControl.type = "checkbox";
  updatePlansControl.id = "workout-update-plans";
  updatePlansLabel.append(
    updatePlansControl,
    make(
      "span",
      "",
      "После сохранения обновить упражнения в запланированных занятиях",
    ),
  );
  editorError.hidden = true;
  workoutForm.append(
    nameField,
    when,
    durationField,
    restField,
    pickerRow,
    customExercise,
    draftEntries,
    goalsField,
    repeatField,
    repeatInterval,
    repeatPreview,
    noteField,
    saveTemplateLabel,
    doneLabel,
    updatePlansLabel,
    editorError,
  );
  const workoutSave = saveRow(workoutForm, "В план и расписание");
  listen($("#workout-date"), "change", () => {
    renderDraftGoals();
    updateRepeatControls(true);
  });
  listen($("#workout-repeat"), "change", () => updateRepeatControls(true));
  for (const id of ["workout-repeat-days", "workout-repeat-until"])
    listen($("#" + id), "input", () => updateRepeatControls());
  listen(doneControl, "change", () => {
    workoutSave.textContent = doneControl.checked
      ? "Сохранить результат"
      : "В план и расписание";
    renderDraftEntries();
    updateRepeatControls();
  });
  function updateRepeatControls(resetDate = false) {
    const repeat = $("#workout-repeat"),
      enabled = !draft?.templateOnly && !draft?.id && !doneControl.checked,
      custom = enabled && repeat.value === "interval",
      until = $("#workout-repeat-until"),
      interval = $("#workout-repeat-days"),
      date = $("#workout-date").value;
    repeat.disabled = !enabled;
    repeatInterval.hidden = !custom;
    until.disabled = interval.disabled = !custom;
    until.min = date;
    until.max = date ? shift(date, 365) : "";
    if (custom && (resetDate || !until.value)) until.value = shift(date, 90);
    repeatPreview.hidden = !enabled || repeat.value === "1";
    if (repeatPreview.hidden) return;
    try {
      const dates = workoutDates(
        date,
        repeat.value,
        Number(interval.value),
        until.value,
      );
      repeatPreview.textContent =
        ctx.translate("Занятий в расписании: ", "Sessions in schedule: ") +
        dates.length +
        " · " +
        ctx.shortDate(dates[0]) +
        " — " +
        ctx.shortDate(dates.at(-1));
    } catch (error) {
      repeatPreview.textContent = ctx.translate(
        String(error.message),
        String(error.message),
      );
    }
  }
  function templateEditorMode(templateOnly) {
    draft.templateOnly = templateOnly;
    for (const node of [
      when,
      goalsField,
      repeatField,
      doneLabel,
      saveTemplateLabel,
    ])
      node.hidden = templateOnly;
    for (const id of ["workout-date", "workout-time"])
      $("#" + id).disabled = templateOnly;
    doneControl.disabled = templateOnly;
    $("#training-edit-dialog-title").textContent = templateOnly
      ? "Занятие"
      : "Тренировка";
    updateRepeatControls();
  }
  function renderExercisePicker() {
    const picker = $("#workout-exercise-picker"),
      previous = picker.value;
    picker.replaceChildren(make("option", "", "Выберите упражнение"));
    picker.firstChild.value = "";
    for (const exercise of snapshot().exercises) {
      const option = user(
        make("option", "", exercise.name + " · " + exercise.unit),
      );
      option.value = exercise.exerciseKey;
      picker.append(option);
    }
    picker.value = previous;
    refreshIcons();
  }
  function addDraftExercise(exercise, plannedValue = null) {
    if (
      !draft ||
      !exercise ||
      draft.entries.some((e) => e.exerciseKey === exercise.exerciseKey)
    )
      return;
    if (draft.entries.length >= 200) {
      ctx.notify(
        ctx.translate(
          "В занятие можно добавить до 200 упражнений.",
          "A session can contain up to 200 exercises.",
        ),
      );
      return;
    }
    draft.entries.push({
      exerciseKey: exercise.exerciseKey,
      name: exercise.name,
      unit: exercise.unit,
      value: null,
      plannedValue,
      sets: 1,
    });
    renderDraftEntries();
    renderDraftGoals();
  }
  function openWorkout(workout = null, complete = false, goal = null) {
    draft = {
      id: workout?.id ?? null,
      originalName: workout?.name || "",
      entries: structuredClone(workout?.entries || []),
      goalKeys: [...(workout?.goalKeys || [])],
      suggestNew: !workout,
      ...session.timerSettings(workout),
    };
    $("#workout-title").value = workout?.name || "";
    $("#workout-date").value =
      workout?.date ||
      localDate(
        new Date(timestampInPersonalDay(trainingDay, "09:00", snapshot())),
      );
    $("#workout-time").value = workout?.time || "09:00";
    $("#workout-duration").value = String(workout?.duration || 45);
    $("#workout-note").value = workout?.result || "";
    $("#workout-repeat").value = "1";
    $("#workout-repeat-days").value = "4";
    $("#workout-repeat-until").value = shift($("#workout-date").value, 90);
    saveTemplateControl.checked = false;
    updatePlansControl.checked = false;
    updatePlansLabel.hidden = !workout || Boolean(workout.healthSource);
    doneControl.checked = complete || Boolean(workout?.done);
    templateEditorMode(false);
    workoutSave.textContent =
      complete || workout?.done
        ? "Сохранить результат"
        : workout
          ? "Сохранить изменения"
          : "В план и расписание";
    editorError.hidden = true;
    renderExercisePicker();
    if (goal?.exerciseKey) {
      const exercise = snapshot().exercises.find(
        (item) => item.exerciseKey === goal.exerciseKey,
      ) || {
        exerciseKey: goal.exerciseKey,
        name: goal.focus,
        unit: goal.unit,
      };
      addDraftExercise(exercise);
      $("#workout-title").value = exercise.name;
      if (goal.from && goal.from > today())
        $("#workout-date").value = goal.from;
      if (goal.until && goal.until < today())
        $("#workout-date").value = goal.until;
    }
    renderDraftEntries();
    renderDraftGoals();
    updateRepeatControls();
    ctx.openDialog("training-edit-dialog");
  }
  const templatesForm = dialog("training-templates-dialog", "Мои занятия"),
    templatesList = make("div", "training-templates-list");
  templatesForm.append(
    action("+ Занятие", () => openWorkoutTemplate(), "button button-primary"),
    make(
      "p",
      "aux-note",
      "Состав занятия сохраняется целиком: упражнения, план и подходы. Результаты в новое занятие не переносятся.",
    ),
    templatesList,
  );
  function templates() {
    return (ctx.extraState.uiPreferences.workoutTemplates ||= []);
  }
  function openTemplates() {
    renderTemplates();
    ctx.openDialog("training-templates-dialog");
  }
  function openWorkoutTemplate(template = null, schedule = false) {
    openWorkout();
    draft.entries = plannedWorkoutEntries(template?.entries || []);
    Object.assign(draft, session.timerSettings(template));
    draft.templateKey = schedule ? null : template?.key || null;
    draft.originalName = template?.name || "";
    $("#workout-title").value = template?.name || "";
    $("#workout-duration").value = String(template?.duration || 45);
    $("#workout-note").value = template?.note || "";
    templateEditorMode(!schedule);
    updatePlansLabel.hidden = schedule || !template;
    workoutSave.textContent = schedule
      ? "В план и расписание"
      : "Сохранить занятие";
    renderDraftEntries();
    renderDraftGoals();
    refreshIcons();
  }
  function renderTemplates() {
    templatesList.replaceChildren();
    if (!templates().length)
      templatesList.append(
        make(
          "p",
          "training-empty",
          "Сохраните своё занятие, чтобы повторно выбирать весь набор упражнений.",
        ),
      );
    for (const template of templates()) {
      const card = make("div", "training-template-card"),
        copy = make("div", "training-template-copy");
      copy.append(
        user(make("strong", "", template.name)),
        make("small", "aux-note", template.duration + " мин"),
        user(
          make(
            "p",
            "aux-note",
            template.entries
              .map(
                (entry) =>
                  entry.name +
                  (entry.plannedValue !== null
                    ? " · " + entry.plannedValue + " " + entry.unit
                    : "") +
                  (entry.sets > 1 ? " × " + entry.sets : ""),
              )
              .join("; "),
          ),
        ),
      );
      const actions = make("div", "training-template-actions");
      actions.append(
        action(
          "В расписание",
          () => openWorkoutTemplate(template, true),
          "button button-primary",
        ),
        iconAction("pencil", "Изменить занятие", () =>
          openWorkoutTemplate(template),
        ),
        iconAction("copy", "Обновить запланированные занятия", () =>
          openPlanUpdate(template),
        ),
        iconAction("trash-2", "Удалить занятие", () =>
          ctx.removeWithUndo(templates(), template, () => {
            renderTemplates();
            ctx.persistState();
          }),
        ),
      );
      card.append(copy, actions);
      templatesList.append(card);
    }
    refreshIcons();
  }
  function saveWorkoutTemplate(values) {
    const items = templates(),
      old = items.find((item) => item.key === draft.templateKey);
    if (!old && items.length >= 100)
      throw Error("Можно сохранить до 100 занятий. Удалите лишнее занятие.");
    if (
      items.some(
        (item) =>
          item !== old &&
          item.name.toLocaleLowerCase() === values.name.toLocaleLowerCase(),
      )
    )
      throw Error(
        "Занятие с таким названием уже есть. Измените его в «Мои занятия».",
      );
    const template = {
      key: old?.key || trainingKey(),
      name: values.name,
      duration: values.duration,
      note: values.result,
      entries: plannedWorkoutEntries(values.entries),
      ...session.timerSettings(values),
    };
    validateTrainingData({
      uiPreferences: {
        workoutTemplates: [...items.filter((item) => item !== old), template],
      },
    });
    if (old) Object.assign(old, template);
    else items.push(template);
    return template;
  }
  function renderDraftEntries() {
    draftEntries.replaceChildren();
    for (const entry of draft.entries) {
      const row = make("div", "workout-exercise-entry");
      row.dataset.exerciseOrderKey = entry.exerciseKey;
      const copy = make("div", "workout-exercise-heading");
      copy.append(
        make("button", "exercise-order-handle"),
        user(make("strong", "", entry.name)),
        iconAction("x", "Убрать упражнение", () => {
          draft.entries.splice(draft.entries.indexOf(entry), 1);
          renderDraftEntries();
          renderDraftGoals();
        }),
      );
      const reorder = copy.firstElementChild;
      reorder.type = "button";
      reorder.classList.add("exercise-order-handle");
      reorder.append(icon("grip-vertical"));
      reorder.setAttribute(
        "aria-label",
        "Переместить упражнение: " + entry.name,
      );
      const values = make("div", "field-row");
      const planned = numeric(
        entry.unit === "раз"
          ? "План · раз за подход"
          : entry.unit === "мин"
            ? "План · мин за подход"
            : "План · " + entry.unit,
        "entry-plan-" + entry.exerciseKey,
        0,
        100000,
        entry.unit === "раз" ? "1" : "0.1",
      );
      const plannedInput = planned.querySelector("input");
      plannedInput.required = false;
      plannedInput.value = entry.plannedValue ?? "";
      plannedInput.placeholder = "Сколько выполнить";
      listen(plannedInput, "input", () => {
        entry.plannedValue =
          plannedInput.value === "" ? null : Number(plannedInput.value);
      });
      values.append(planned);
      const result = numeric(
        entry.unit === "раз"
          ? "Факт · раз за подход"
          : entry.unit === "мин"
            ? "Факт · мин за подход"
            : "Факт · " + entry.unit,
        "entry-value-" + entry.exerciseKey,
        0,
        100000,
        entry.unit === "раз" ? "1" : "0.1",
      );
      const input = result.querySelector("input");
      input.required = false;
      input.value =
        entry.value === null || entry.value === undefined
          ? ""
          : String(entry.value);
      input.placeholder = "После тренировки";
      listen(input, "input", () => {
        entry.value = input.value === "" ? null : Number(input.value);
      });
      const actual = make("div", "workout-actual-result");
      actual.append(result);
      actual.hidden = !doneControl.checked && !Number.isFinite(entry.value);
      row.append(copy, values, actual);
      if (["раз", "кг", "мин"].includes(entry.unit)) {
        const sets = numeric(
          "Подходы",
          "entry-sets-" + entry.exerciseKey,
          1,
          100,
          "1",
        );
        const control = sets.querySelector("input");
        control.value = String(entry.sets || 1);
        listen(control, "change", () => {
          if (!control.checkValidity() || control.validity.badInput) return;
          entry.sets = Number(control.value);
          if (entry.setResults) {
            entry.setResults = Array.from(
              { length: entry.sets },
              (_, index) =>
                entry.setResults[index] || { value: null, done: false },
            );
            entry.done = entry.setResults.every((set) => set.done);
            entry.value = entryMeasurement(entry);
          }
        });
        values.append(sets);
      }
      if (["раз", "кг", "мин"].includes(entry.unit))
        row.append(
          make(
            "small",
            "aux-note",
            "После планирования можно записать и отметить каждый подход отдельно.",
          ),
        );
      draftEntries.append(row);
    }
    if (!draft.entries.length)
      draftEntries.append(
        make(
          "p",
          "aux-note",
          "Добавьте упражнение и укажите свой план. Фактический результат записывается после выполнения.",
        ),
      );
    refreshIcons();
    ctx.fitDialog();
  }
  function renderDraftGoals() {
    if (!draft) return;
    draftGoals.replaceChildren();
    const available = activeGoals(
      snapshot().trainingGoals,
      ctx.lifeDay(
        { date: $("#workout-date").value, time: $("#workout-time").value },
        "workouts",
      ),
      draft.entries,
    );
    draft.goalKeys = available.map((goal) => goal.goalKey);
    for (const goal of available) {
      draftGoals.append(user(make("p", "workout-auto-goal", goal.name)));
    }
    if (available.length)
      draftGoals.append(
        make(
          "small",
          "aux-note",
          "Обновляются автоматически по результатам упражнений",
        ),
      );
    if (!available.length)
      draftGoals.append(
        make(
          "p",
          "aux-note",
          "Создайте цель для этого упражнения или цель по количеству тренировок.",
        ),
      );
  }
  listen(workoutForm, "submit", (event) => {
    event.preventDefault();
    if (!draft || !workoutForm.reportValidity()) return;
    const data = snapshot(),
      old = data.workouts.find((w) => w.id === draft.id);
    const time = $("#workout-time").value,
      date = $("#workout-date").value;
    const duration = Number($("#workout-duration").value);
    const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (
      start + duration > 1439 &&
      !draft.templateOnly &&
      !(old?.healthSource && doneControl.checked)
    ) {
      editorError.textContent =
        "Тренировка должна закончиться в пределах выбранного дня.";
      editorError.hidden = false;
      return;
    }
    const eligible = new Set(
      activeGoals(
        data.trainingGoals,
        ctx.lifeDay({ date, time }, "workouts"),
        draft.entries,
      ).map((g) => g.goalKey),
    );
    const values = {
      name: $("#workout-title").value.trim(),
      focus: $("#workout-title").value.trim(),
      date,
      time,
      duration,
      result: $("#workout-note").value.trim(),
      done: doneControl.checked,
      entries: structuredClone(draft.entries),
      goalKeys: [...eligible],
      ...session.timerSettings(draft),
    };
    if (!values.name) return;
    let dates, savedTemplate;
    try {
      dates =
        old || doneControl.checked || draft.templateOnly
          ? [date]
          : workoutDates(
              date,
              $("#workout-repeat").value,
              Number($("#workout-repeat-days").value),
              $("#workout-repeat-until").value,
            );
      if (
        !old &&
        !draft.templateOnly &&
        (data.workouts.length + dates.length > 100000 ||
          data.events.length + dates.length > 100000)
      )
        throw Error("Слишком много записей. Уменьшите период повторов.");
      if (draft.templateOnly || saveTemplateControl.checked)
        savedTemplate = saveWorkoutTemplate(values);
    } catch (error) {
      editorError.textContent = ctx.translate(error.message, error.message);
      editorError.hidden = false;
      return;
    }
    if (draft.templateOnly) {
      ctx.closeDialog();
      ctx.persistState();
      openTemplates();
      ctx.notify(ctx.translate("Занятие сохранено", "Session saved"));
      if (updatePlansControl.checked && savedTemplate)
        openPlanUpdate(savedTemplate, draft.originalName || savedTemplate.name);
      return;
    }
    if (values.done || (old && old.done !== values.done)) {
      for (const entry of values.entries) {
        entry.done = values.done;
        if (values.done) {
          entry.completedAt ||= Date.now();
          recordPlannedResult(entry);
        } else {
          delete entry.completedAt;
          for (const set of entry.setResults || []) {
            set.done = false;
            delete set.completedAt;
          }
        }
      }
    }
    if (old) {
      Object.assign(old, values);
      if (old.healthSource) old.manualOverride = true;
      if (old.done) old.completedAt = Date.now();
      else delete old.completedAt;
      syncEvent(old);
    } else {
      const seriesKey = dates.length > 1 ? trainingKey() : null;
      for (const [i, day] of dates.entries()) {
        const keys = new Set(
          activeGoals(
            data.trainingGoals,
            ctx.lifeDay({ date: day, time }, "workouts"),
            values.entries,
          ).map((g) => g.goalKey),
        );
        const workout = {
          ...structuredClone(values),
          id: ctx.createId(),
          trainingKey: trainingKey(),
          date: day,
          goalKeys: [...keys],
        };
        if (seriesKey) workout.seriesKey = seriesKey;
        // A planned result is never copied into future sessions.
        if (i > 0) workout.entries = plannedWorkoutEntries(workout.entries);
        if (workout.done) workout.completedAt = Date.now();
        data.workouts.push(workout);
        syncEvent(workout);
      }
    }
    month.value = date.slice(0, 7);
    if (planScope === "day") selectTrainingDay(date, false);
    ctx.closeDialog();
    refresh();
    ctx.notify("Сохранено");
    if (old && updatePlansControl.checked)
      openPlanUpdate(old, draft.originalName);
  });
  function syncEvent(workout) {
    const data = snapshot();
    const end =
      Number(workout.time.slice(0, 2)) * 60 +
      Number(workout.time.slice(3)) +
      workout.duration;
    const existing = data.events.find((e) => e.workoutId === workout.id);
    if (end > 1439) {
      if (existing) data.events.splice(data.events.indexOf(existing), 1);
      return;
    }
    const fields = {
      title: workout.name,
      date: workout.date,
      start: workout.time,
      end:
        String(Math.floor(end / 60)).padStart(2, "0") +
        ":" +
        String(end % 60).padStart(2, "0"),
      done: workout.done,
    };
    if (existing) Object.assign(existing, fields);
    else
      data.events.push({
        id: ctx.createId(),
        workoutId: workout.id,
        context: "Личное",
        tone: "pine",
        ...fields,
      });
  }

  // Goal editor exposes the exercise link and the counting rule.
  const goalForm = dialog("training-goal-dialog", "Цель упражнения");
  goalForm.append(
    select("Тип цели", "training-goal-kind", [
      ["result", "Результат упражнения"],
      ["count", "Количество тренировок"],
    ]),
  );
  const goalExercise = select("Упражнение", "training-goal-exercise", []);
  const goalAddExercise = action(
    "+ Своё упражнение",
    () =>
      openExercise(null, (exercise) => {
        if (exercise) {
          const option = user(
            make("option", "", exercise.name + " · " + exercise.unit),
          );
          option.value = exercise.exerciseKey;
          $("#training-goal-exercise").append(option);
          $("#training-goal-exercise").value = exercise.exerciseKey;
        }
        updateGoalKind();
        ctx.openDialog("training-goal-dialog");
      }),
    "text-button",
  );
  const goalNumbers = make("div", "field-row");
  const calculationField = select(
    "Как считать прогресс",
    "training-goal-calculation",
    [
      ["latest", "За один подход"],
      ["total", "Всего за период"],
    ],
  );
  const baselineField = numeric(
    "Сейчас · по желанию",
    "training-goal-baseline",
  );
  const targetField = numeric("Хочу достичь", "training-goal-target", 0.1);
  const targetCaption = make("span", "", "Хочу достичь");
  targetField.firstChild.replaceWith(targetCaption);
  const baselineCaption = make("span", "", "Сейчас · по желанию");
  baselineField.firstChild.replaceWith(baselineCaption);
  baselineField.querySelector("input").required = false;
  goalNumbers.append(targetField, baselineField);
  const period = make("div", "field-row");
  period.append(
    field("С даты", "training-goal-from", "date"),
    field("До даты · по желанию", "training-goal-until", "date", false),
  );
  const goalExplanation = make("p", "aux-note");
  const goalError = make("p", "error");
  goalError.hidden = true;
  goalForm.append(
    goalExercise,
    goalAddExercise,
    calculationField,
    goalNumbers,
    field("Название · по желанию", "training-goal-name", "text", false),
    period,
    goalExplanation,
    goalError,
  );
  const goalSave = saveRow(goalForm, "Сохранить цель");
  let editingGoal = null;
  listen($("#training-goal-kind"), "change", updateGoalKind);
  listen($("#training-goal-exercise"), "change", updateGoalKind);
  listen($("#training-goal-calculation"), "change", updateGoalKind);
  function updateGoalKind() {
    const count = $("#training-goal-kind").value === "count";
    const exercise = snapshot().exercises.find(
      (item) => item.exerciseKey === $("#training-goal-exercise").value,
    );
    const unit = count
      ? "тренировок"
      : exercise?.unit || editingGoal?.unit || "раз";
    const whole = count || unit === "раз";
    goalExercise.hidden = goalAddExercise.hidden = baselineField.hidden = count;
    calculationField.hidden = count;
    const total = !count && $("#training-goal-calculation").value === "total";
    baselineCaption.textContent = total
      ? "Уже выполнено · по желанию"
      : "Сейчас · по желанию";
    $("#training-goal-calculation").querySelector(
      '[value="latest"]',
    ).textContent = ["раз", "кг"].includes(unit)
      ? "За один подход"
      : "За одно занятие";
    $("#training-goal-exercise").required = !count;
    $("#training-goal-baseline").required = false;
    $("#training-goal-baseline").step = whole ? "1" : "0.1";
    $("#training-goal-target").step = whole ? "1" : "0.1";
    $("#training-goal-target").min = whole ? "1" : "0.1";
    $("#training-goal-target").inputMode = whole ? "numeric" : "decimal";
    targetCaption.textContent = "Хочу достичь · " + unit;
    $("#training-goal-target").placeholder =
      unit === "раз" ? "Например, 20" : "Введите число";
    goalExplanation.textContent = count
      ? "Все выполненные тренировки этого периода учитываются автоматически."
      : total
        ? unit === "раз"
          ? "Складываем фактические повторы завершённых подходов. Без отдельных подходов: факт × подходы. Начальное значение добавляется один раз."
          : unit === "кг"
            ? "Складываем фактические веса завершённых подходов. Если подходы не разделены, учитывается один записанный вес."
            : "Складываем результаты выполненных занятий за период. Начальное значение добавляется один раз."
        : "Результаты выбранного упражнения учитываются автоматически. Процент — лучший завершённый подход последней тренировки относительно цели.";
    ctx.fitDialog();
  }
  function openGoal(goal = null) {
    editingGoal = goal;
    $("#training-goal-name").value = goal?.name || "";
    $("#training-goal-kind").value = goal?.kind || "result";
    $("#training-goal-calculation").value = goal?.calculation || "latest";
    $("#training-goal-kind").disabled = Boolean(goal?.kind);
    $("#training-goal-baseline").value = String(goal?.baseline || 0);
    $("#training-goal-target").value = goal ? String(goal.target) : "";
    $("#training-goal-from").value = goal?.from || today();
    $("#training-goal-until").value = goal?.until || "";
    const picker = $("#training-goal-exercise");
    picker.replaceChildren(make("option", "", "Выберите упражнение"));
    picker.firstChild.value = "";
    for (const exercise of snapshot().exercises) {
      const option = user(
        make("option", "", exercise.name + " · " + exercise.unit),
      );
      option.value = exercise.exerciseKey;
      picker.append(option);
    }
    if (
      goal?.exerciseKey &&
      !snapshot().exercises.some(
        (exercise) => exercise.exerciseKey === goal.exerciseKey,
      )
    ) {
      const option = user(make("option", "", goal.focus + " · " + goal.unit));
      option.value = goal.exerciseKey;
      picker.append(option);
    }
    picker.value = goal?.exerciseKey || "";
    picker.disabled = Boolean(
      goal?.exerciseKey &&
      snapshot().workouts.some((w) => w.goalKeys?.includes(goal.goalKey)),
    );
    goalAddExercise.disabled = picker.disabled;
    goalError.hidden = false;
    goalError.textContent =
      goal && !goal.kind
        ? "Эта цель из предыдущей версии. Выберите упражнение, чтобы связать её с тренировками. История сохранится."
        : "";
    goalSave.disabled = false;
    updateGoalKind();
    ctx.openDialog("training-goal-dialog");
  }
  listen(goalForm, "submit", (event) => {
    event.preventDefault();
    if (!goalForm.reportValidity()) return;
    const kind = $("#training-goal-kind").value;
    let exercise = snapshot().exercises.find(
      (e) => e.exerciseKey === $("#training-goal-exercise").value,
    );
    if (
      !exercise &&
      editingGoal?.exerciseKey === $("#training-goal-exercise").value
    )
      exercise = {
        exerciseKey: editingGoal.exerciseKey,
        name: editingGoal.focus,
        unit: editingGoal.unit,
      };
    const baseline =
      kind === "count" ? 0 : Number($("#training-goal-baseline").value);
    const target = Number($("#training-goal-target").value);
    const from = $("#training-goal-from").value,
      until = $("#training-goal-until").value;
    if (
      target <= baseline ||
      (until && until < from) ||
      (kind === "result" && !exercise)
    ) {
      goalError.hidden = false;
      goalError.textContent =
        "Проверьте упражнение, период и цель: результат должен быть больше начального.";
      return;
    }
    if (
      editingGoal?.history?.length &&
      kind === "result" &&
      editingGoal.kind !== "count" &&
      exercise.unit !== editingGoal.unit
    ) {
      goalError.hidden = false;
      goalError.textContent =
        "Упражнение использует другую единицу. Создайте новую цель, чтобы сохранить историю результатов.";
      return;
    }
    const values = {
      name:
        $("#training-goal-name").value.trim() ||
        (kind === "count"
          ? target + " тренировок"
          : exercise.name + " · " + target + " " + exercise.unit),
      kind,
      calculation:
        kind === "count" ? "latest" : $("#training-goal-calculation").value,
      baseline,
      target,
      from,
      until,
      exerciseKey: kind === "result" ? exercise.exerciseKey : "",
      focus: kind === "result" ? exercise.name : "Тренировки",
      unit: kind === "result" ? exercise.unit : "тренировок",
    };
    if (!values.name) return;
    let goal = editingGoal;
    if (goal) {
      // Keep the original starting point out of actual measurements even when
      // its value changes. Workout history remains untouched on mode changes.
      normalizeTraining(snapshot());
      const initial = goal.history.find((point) => point.initial);
      if (initial) initial.value = baseline;
      Object.assign(goal, values);
    } else {
      goal = {
        id: ctx.createId(),
        goalKey: trainingKey(),
        current: baseline,
        history: [{ at: Date.now(), value: baseline, initial: true }],
        ...values,
      };
      snapshot().trainingGoals.push(goal);
    }
    ctx.closeDialog();
    refresh();
    openGoalDetail(goal);
  });
  const goalDetail = dialog("training-goal-detail-dialog", "Прогресс цели");
  const goalDetailContent = make("div", "training-goal-detail");
  goalDetail.append(goalDetailContent);
  function openGoalDetail(goal) {
    const state = goalState(goal, snapshot().workouts, snapshot());
    goalDetailContent.replaceChildren();
    const description = user(make("h3", "", goal.name));
    const value = make(
      "p",
      "training-goal-detail-value",
      state.current +
        " / " +
        goal.target +
        " " +
        goal.unit +
        " · " +
        state.percent +
        "%",
    );
    goalDetailContent.append(
      description,
      value,
      make(
        "p",
        "aux-note",
        goal.kind === "count"
          ? "Все выполненные тренировки выбранного периода."
          : goal.exerciseKey
            ? totalsGoal(goal)
              ? goal.unit === "раз"
                ? "Складываем выполненные повторы за период: факт × подходы. Начальное значение добавляется один раз."
                : goal.unit === "кг"
                  ? "Складываем записанные рабочие веса за период. Количество подходов не умножает килограммы."
                  : "Складываем результаты выполненных занятий за период. Начальное значение добавляется один раз."
              : "Последний результат упражнения. Галочки и результаты в тренировках обновляют цель автоматически."
            : "Результаты пока записываются вручную. Выберите упражнение в настройках цели.",
      ),
    );
    const buttons = make("div", "training-actions");
    buttons.append(
      action(
        "В расписание",
        () => openWorkout(null, false, goal),
        "button button-primary",
      ),
      action("Изменить цель", () => openGoal(goal), "button"),
      action(
        "Удалить",
        () => {
          ctx.closeDialog();
          ctx.removeWithUndo(snapshot().trainingGoals, goal, refresh);
        },
        "text-button",
      ),
    );
    goalDetailContent.append(buttons);
    if (goal.kind !== "count" && !goal.exerciseKey) {
      const manual = make("div", "training-manual-result");
      const measure = numeric(
        "Записать результат отдельно · " + goal.unit,
        "goal-manual-value",
      );
      measure.querySelector("input").value = String(state.current);
      manual.append(
        measure,
        action(
          "Записать",
          () => {
            const input = $("#goal-manual-value");
            if (!input.reportValidity()) return;
            goal.current = Number(input.value);
            goal.history.push({ at: Date.now(), value: goal.current });
            refresh();
            openGoalDetail(goal);
          },
          "button",
        ),
      );
      goalDetailContent.append(manual);
    }
    const history =
      goal.kind === "count"
        ? state.linked
            .map((w) => ({
              date: w.date,
              name: w.name,
              value: 1,
              workoutKey: w.trainingKey,
            }))
            .reverse()
        : state.history;
    const historyHost = make("div", "training-goal-history");
    historyHost.append(make("h4", "", "История"));
    for (const point of history.slice(0, 50)) {
      const row = make("div", "training-goal-history-row");
      row.append(
        make("span", "", ctx.shortDate(point.date)),
        user(make("span", "", point.name || "Ручная запись")),
        make(
          "strong",
          "",
          (totalsGoal(goal) ? "+" : "") + point.value + " " + goal.unit,
        ),
      );
      if (totalsGoal(goal) && goal.unit === "раз" && point.sets > 1)
        row.append(
          make("small", "aux-note", point.result + " × " + point.sets),
        );
      if (point.workoutKey)
        row.append(
          action(
            "Открыть",
            () => {
              const workout = snapshot().workouts.find(
                (w) => w.trainingKey === point.workoutKey,
              );
              if (workout) openResults(workout);
            },
            "text-button",
          ),
        );
      historyHost.append(row);
    }
    goalDetailContent.append(historyHost);
    ctx.openDialog("training-goal-detail-dialog");
    refreshIcons();
  }
  function renderGoals() {
    goalList.replaceChildren();
    const data = snapshot(),
      states = data.trainingGoals.map((goal) =>
        goalState(goal, data.workouts, data),
      ),
      percent = states.length
        ? Math.round(
            states.reduce((sum, state) => sum + state.percent, 0) /
              states.length,
          )
        : 0;
    goalRing.textContent = states.length ? percent + "%" : "—";
    goalRing.style.setProperty("--progress", percent + "%");
    goalSummaryNote.textContent = states.length
      ? ctx.translate("Среднее по целям: ", "Average across goals: ") +
        states.length +
        " · " +
        ctx.translate("Достигнуто: ", "Achieved: ") +
        states.filter((state) => state.percent === 100).length
      : ctx.translate("Добавьте свою первую цель", "Add your first goal");
    goalList.hidden = !goalsExpanded;
    for (const [index, goal] of data.trainingGoals.entries())
      goal.current = states[index].current;
    if (!goalsExpanded) return;
    if (!snapshot().trainingGoals.length)
      goalList.append(
        make(
          "p",
          "aux-note",
          "Выберите цель: улучшить результат упражнения или заниматься регулярно.",
        ),
      );
    for (const [index, goal] of data.trainingGoals.entries()) {
      const state = states[index];
      goal.current = state.current;
      const button = action(
        "",
        () => openGoalDetail(goal),
        "training-goal-card",
      );
      const ring = make("span", "training-goal-ring", state.percent + "%");
      ring.style.setProperty("--progress", state.percent + "%");
      const copy = make("span", "training-goal-copy");
      copy.append(
        user(make("strong", "", goal.name)),
        make(
          "small",
          "aux-note",
          state.current + " / " + goal.target + " " + goal.unit,
        ),
        make("small", "aux-note", calculationLabel(goal)),
      );
      if (state.percent === 100)
        copy.append(make("small", "training-goal-achieved", "Цель достигнута"));
      button.append(ring, copy);
      const card = make("div", "training-goal-item");
      card.append(
        button,
        action(
          "В расписание",
          () => openWorkout(null, false, goal),
          "text-button training-goal-plan",
        ),
      );
      goalList.append(card);
    }
  }

  function completedExercise(workout, entry) {
    return workout.done || entry.done === true;
  }
  function recordPlannedResult(entry) {
    if (!Number.isFinite(entry.value) && Number.isFinite(entry.plannedValue))
      entry.value = entry.plannedValue;
    if (entry.setResults) {
      for (const set of entry.setResults) {
        set.done = true;
        set.value ??= entry.value ?? entry.plannedValue ?? 0;
        set.completedAt ||= Date.now();
      }
      entry.value = entryMeasurement(entry);
    }
  }
  function updateCompletion(workout) {
    if (workout.done) workout.completedAt ||= Date.now();
    else delete workout.completedAt;
    for (const event of snapshot().events.filter(
      (item) => item.workoutId === workout.id,
    )) {
      event.done = workout.done;
      if (!event.done) event.win = false;
    }
    if (!workout.done) workout.win = false;
    if (workout.healthSource) workout.manualOverride = true;
  }
  function toggleCompletion(workout) {
    workout = snapshot().workouts.find(
      (item) => item.trainingKey === workout.trainingKey,
    );
    if (!workout) return;
    workout.done = !workout.done;
    for (const entry of workout.entries || []) {
      entry.done = workout.done;
      if (entry.done) {
        entry.completedAt = Date.now();
        recordPlannedResult(entry);
      } else {
        delete entry.completedAt;
        for (const set of entry.setResults || []) {
          set.done = false;
          delete set.completedAt;
        }
      }
    }
    updateCompletion(workout);
    refresh();
    paintQuickResults();
    if (!$("#training-results-dialog").hidden) renderResults(workout);
  }
  function paintQuickResults() {
    const data = snapshot();
    for (const row of root.querySelectorAll("[data-training-entry-key]")) {
      const workout = data.workouts.find(
        (item) => item.trainingKey === row.dataset.trainingWorkoutKey,
      );
      const entry = workout?.entries?.find(
        (item) => item.exerciseKey === row.dataset.trainingEntryKey,
      );
      if (!entry) continue;
      paintQuickRow(row, workout, entry);
    }
    for (const button of root.querySelectorAll("[data-training-toggle]")) {
      const workout = data.workouts.find(
        (item) => item.trainingKey === button.dataset.trainingToggle,
      );
      if (!workout) continue;
      setCompletionIcon(button, workout.done);
    }
    for (const progress of root.querySelectorAll("[data-workout-progress]")) {
      const workout = data.workouts.find(
        (item) => item.trainingKey === progress.dataset.workoutProgress,
      );
      if (workout) paintWorkoutProgress(progress, workout);
    }
  }
  function paintWorkoutProgress(node, workout) {
    const entries = workout.entries || [],
      completed = entries.filter((entry) =>
        completedExercise(workout, entry),
      ).length;
    node.textContent = entries.length
      ? ctx.translate("Упражнения", "Exercises") +
        " · " +
        completed +
        " / " +
        entries.length
      : ctx.translate("Занятие без упражнений", "Session without exercises");
    node.dataset.complete = String(workout.done);
  }
  const openWorkouts = new Set();
  function mountCompactResults(host, workout, fullHeading = false) {
    if (!fullHeading) {
      const row = make("div", "training-home-session"),
        button = action(
          "",
          () => {
            const current = snapshot().workouts.find(
              (w) => w.trainingKey === workout.trainingKey,
            );
            if (current) openResults(current);
          },
          "text-button training-home-results",
        ),
        progress = make("span", "training-workout-progress");
      progress.dataset.workoutProgress = workout.trainingKey;
      paintWorkoutProgress(progress, workout);
      button.append(progress, icon("chevron-right"));
      button.setAttribute(
        "aria-label",
        "Открыть все упражнения: " + workout.name,
      );
      row.append(button);
      session.attachTimer(row, workout);
      host.append(row);
      return { details: row, body: row };
    }
    const details = make("details", "training-workout-details"),
      summary = make("summary", "training-workout-summary"),
      copy = make("span", "training-workout-summary-copy"),
      progress = make("small", "training-workout-progress"),
      body = make("div", "training-inline-results training-workout-body"),
      scopeKey = (fullHeading ? "plan:" : "home:") + workout.trainingKey;
    progress.dataset.workoutProgress = workout.trainingKey;
    if (fullHeading)
      copy.append(
        user(make("strong", "training-workout-name", workout.name)),
        make(
          "small",
          "aux-note",
          ctx.shortDate(workout.date) +
            " · " +
            workout.time +
            " · " +
            workout.duration +
            " мин",
        ),
      );
    copy.append(progress);
    summary.append(copy);
    session.attachTimer(summary, workout);
    summary.append(icon("chevron-right"));
    details.append(summary, body);
    host.append(details);
    let mounted = false;
    const mount = () => {
      if (mounted) return;
      mounted = true;
      const current = snapshot().workouts.find(
        (row) => row.trainingKey === workout.trainingKey,
      );
      if (current) mountQuickResults(body, current);
      refreshIcons();
    };
    details.open = openWorkouts.has(scopeKey);
    listen(details, "toggle", () => {
      if (!details.isConnected || disposed) return;
      if (details.open) {
        openWorkouts.add(scopeKey);
        mount();
      } else openWorkouts.delete(scopeKey);
    });
    paintWorkoutProgress(progress, workout);
    if (details.open) mount();
    return { details, body };
  }
  function paintQuickRow(row, workout, entry) {
    const completed = completedExercise(workout, entry);
    row.dataset.done = String(completed);
    const check = row.querySelector(".training-exercise-check");
    setCompletionIcon(check, completed);
    check.setAttribute(
      "aria-label",
      (completed ? "Вернуть упражнение: " : "Выполнить упражнение: ") +
        entry.name,
    );
    const input = row.querySelector("input");
    input.readOnly = Boolean(entry.setResults);
    input.title = entry.setResults
      ? ctx.translate(
          "Лучший подход. Отдельные значения — в подходах ниже.",
          "Best set. Edit individual values in the sets below.",
        )
      : "";
    if (document.activeElement !== input) input.value = entry.value ?? "";
    const goals = activeGoals(snapshot().trainingGoals, workout.date, [
      entry,
    ]).filter((goal) => goal.kind !== "count");
    const progress = row.querySelector(".training-entry-progress");
    progress.replaceChildren();
    for (const goal of goals) {
      const total = totalsGoal(goal);
      const state = total
        ? goalState(goal, snapshot().workouts, snapshot())
        : null;
      const value = total
        ? state.current
        : completed && Number.isFinite(entry.value)
          ? entry.value
          : entry.setResults?.some((set) => set.done)
            ? entryMeasurement(entry)
            : null;
      const percent = total
        ? state.percent
        : Math.min(100, Math.round((value / goal.target) * 100));
      progress.append(
        make(
          "span",
          "",
          total
            ? "Всего за период"
            : ["раз", "кг"].includes(goal.unit)
              ? entry.setResults
                ? "Лучший подход"
                : "Этот подход"
              : "Это занятие",
        ),
        make(
          "span",
          "",
          value === null
            ? "Цель: " + goal.target + " " + goal.unit
            : value +
                " / " +
                goal.target +
                " " +
                goal.unit +
                " · " +
                percent +
                "%",
        ),
      );
    }
    progress.hidden = !goals.length;
  }
  function mountQuickResults(host, workout) {
    installExerciseOrder(
      ctx,
      host,
      () =>
        snapshot().workouts.find(
          (item) => item.trainingKey === workout.trainingKey,
        )?.entries || [],
      () => {
        refresh();
        if (!$("#training-results-dialog").hidden)
          renderResults(
            snapshot().workouts.find(
              (item) => item.trainingKey === workout.trainingKey,
            ),
          );
      },
    );
    for (const entry of workout.entries || []) {
      const row = make("div", "training-inline-entry");
      row.dataset.exerciseOrderKey = entry.exerciseKey;
      row.dataset.trainingWorkoutKey = workout.trainingKey;
      row.dataset.trainingEntryKey = entry.exerciseKey;
      const check = action(
        "",
        () => {
          const current = snapshot().workouts.find(
            (item) => item.trainingKey === workout.trainingKey,
          );
          const selected = current?.entries?.find(
            (item) => item.exerciseKey === entry.exerciseKey,
          );
          if (!selected) return;
          const next = !completedExercise(current, selected);
          for (const item of current.entries)
            item.done = completedExercise(current, item);
          selected.done = next;
          if (next) {
            selected.completedAt = Date.now();
            recordPlannedResult(selected);
          } else {
            delete selected.completedAt;
            for (const set of selected.setResults || []) {
              set.done = false;
              delete set.completedAt;
            }
          }
          current.done = current.entries.every((item) => item.done);
          const homeTask = host.closest("#task-list .task");
          updateCompletion(current);
          refresh();
          paintQuickResults();
          if (next) session.beginRest(current);
          if (!$("#training-results-dialog").hidden) renderResults(current);
          if (homeTask) {
            const list = root.querySelector("#task-list");
            const updatedTask = [
              ...list.querySelectorAll(":scope > .task"),
            ].find((row) => row.dataset.taskId === homeTask.dataset.taskId);
            const target = current.done
              ? list.querySelector('.task[data-done="false"] > .task-check') ||
                updatedTask?.querySelector(":scope > .task-check")
              : [
                  ...(updatedTask?.querySelectorAll(
                    "[data-training-entry-key]",
                  ) || []),
                ]
                  .find(
                    (row) => row.dataset.trainingEntryKey === entry.exerciseKey,
                  )
                  ?.querySelector(".training-exercise-check");
            target?.focus({ preventScroll: true });
          }
        },
        "task-check training-exercise-check",
      );
      check.setAttribute("aria-label", "Выполнить упражнение: " + entry.name);
      const name = user(make("span", "training-inline-name", entry.name));
      const plan = [];
      if (Number.isFinite(entry.plannedValue))
        plan.push("План: " + entry.plannedValue + " " + entry.unit);
      if (entry.sets > 1) plan.push(entry.sets + " подходов");
      if (plan.length) name.append(make("small", "aux-note", plan.join(" · ")));
      const label = make("label", "training-inline-measure");
      const input = make("input", "training-inline-value");
      Object.assign(input, {
        type: "number",
        min: "0",
        max: "100000",
        step: entry.unit === "раз" ? "1" : "0.1",
        inputMode: entry.unit === "раз" ? "numeric" : "decimal",
        placeholder: "Факт",
        value: entry.value ?? "",
      });
      input.setAttribute(
        "aria-label",
        "Результат: " + entry.name + " · " + entry.unit,
      );
      const commit = () => {
        if (input.validity.badInput || !input.checkValidity()) return;
        const current = snapshot().workouts.find(
          (item) => item.trainingKey === workout.trainingKey,
        );
        const selected = current?.entries?.find(
          (item) => item.exerciseKey === entry.exerciseKey,
        );
        if (!selected) return;
        const value = input.value === "" ? null : Number(input.value);
        if (selected.value === value) return;
        selected.value = value;
        if (selected.setResults) {
          for (const set of selected.setResults) set.value = value;
          if (value === null) {
            selected.done = false;
            for (const set of selected.setResults) {
              set.done = false;
              delete set.completedAt;
            }
            current.done = false;
            updateCompletion(current);
          }
        }
        if (current.healthSource) current.manualOverride = true;
        normalizeTraining(snapshot());
        renderGoals();
        paintQuickResults();
        ctx.persistState();
      };
      listen(input, "input", commit);
      listen(input, "change", commit);
      listen(input, "blur", () => {
        if (!input.checkValidity()) input.reportValidity();
      });
      listen(input, "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      label.append(
        input,
        make(
          "span",
          "aux-note",
          ["раз", "мин"].includes(entry.unit) && entry.sets > 1
            ? entry.unit + "/подход"
            : entry.unit,
        ),
      );
      const progress = make("small", "training-entry-progress");
      const reorder = iconAction(
        "grip-vertical",
        "Переместить упражнение: " + entry.name,
        () => {},
      );
      reorder.classList.add("exercise-order-handle");
      row.append(reorder, check, name, label, progress);
      host.append(row);
      paintQuickRow(row, workout, entry);
      session.append(row, workout, entry);
    }
    paintQuickResults();
  }
  const quickForm = dialog("training-results-dialog", "Результаты тренировки");
  const quickBody = make("div", "training-quick-body");
  quickForm.append(quickBody);
  function renderResults(workout) {
    quickBody.replaceChildren();
    const head = make("div", "training-quick-heading");
    const check = action("", () => toggleCompletion(workout), "task-check");
    check.dataset.trainingToggle = workout.trainingKey;
    check.setAttribute("aria-label", "Отметить тренировку: " + workout.name);
    head.append(check, user(make("h3", "", workout.name)));
    session.attachTimer(head, workout);
    quickBody.append(
      head,
      make(
        "p",
        "aux-note",
        "Галочка отмечает выполнение по плану. Факт можно изменить; всё сохраняется автоматически.",
      ),
    );
    mountQuickResults(quickBody, workout);
    session.appendEffort(quickBody, workout);
    const actions = make("div", "dialog-actions");
    actions.append(
      action(
        "Удалить несколько занятий…",
        () => openBatchDelete(workout),
        "text-button",
      ),
      action(
        "Изменить план",
        () => {
          const current = snapshot().workouts.find(
            (item) => item.trainingKey === workout.trainingKey,
          );
          if (current) openWorkout(current);
        },
        "text-button",
      ),
      action("Готово", ctx.closeDialog, "button"),
    );
    quickBody.append(actions);
    paintQuickResults();
    refreshIcons();
  }
  function openResults(workout) {
    renderResults(workout);
    ctx.openDialog("training-results-dialog");
  }
  function renderPlan() {
    let illnessNotice = $("#training-illness-notice");
    if (!illnessNotice) {
      illnessNotice = make("p", "illness-section-notice");
      illnessNotice.id = "training-illness-notice";
      planList.before(illnessNotice);
    }
    illnessNotice.hidden = planScope !== "day" || !ctx.isIllDay(trainingDay);
    illnessNotice.textContent =
      "Болезнь / восстановление · можно пропустить тренировку. Выполненные подходы и результаты сохраняются.";
    paintTrainingDays();
    const selected = month.value || today().slice(0, 7);
    const items = snapshot().workouts.filter((w) =>
      planScope === "day"
        ? ctx.lifeDay(w, "workouts") === trainingDay
        : ctx.lifeDay(w, "workouts").startsWith(selected),
    );
    const adherence = workoutAdherence(items, snapshot());
    planCount.textContent =
      adherence.done +
      " / " +
      adherence.eligible +
      (adherence.excused ? " · по болезни: " + adherence.excused : "");
    filters
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.trainingFilter === filter),
        ),
      );
    const list = items
      .filter((w) => filter === "all" || w.done === (filter === "done"))
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
      );
    planList.replaceChildren();
    if (!list.length)
      planList.append(
        make(
          "p",
          "training-empty",
          "Здесь появятся запланированные и выполненные тренировки.",
        ),
      );
    for (const workout of list.slice(0, visibleRows)) {
      const row = make("article", "training-workout-row");
      row.dataset.workoutId = String(workout.id);
      const check = action("", () => toggleCompletion(workout), "task-check");
      check.dataset.trainingToggle = workout.trainingKey;
      check.setAttribute("aria-pressed", String(workout.done));
      check.setAttribute(
        "aria-label",
        workout.done ? "Вернуть тренировку в план" : "Завершить тренировку",
      );
      const copy = make("div", "training-workout-copy");
      if (!workout.done && ctx.isIllDay(ctx.lifeDay(workout, "workouts")))
        copy.append(
          make(
            "small",
            "illness-note",
            "Пропуск по болезни · не снижает выполнение плана",
          ),
        );
      const disclosure = mountCompactResults(copy, workout, true);
      session.appendEffort(copy, workout);
      const entries = make("div", "training-workout-results");
      if (workout.steps !== null && workout.steps !== undefined)
        entries.append(make("span", "", workout.steps + " шагов"));
      if (workout.healthSource)
        entries.append(make("span", "training-import-label", "Health Connect"));
      const linked = snapshot().trainingGoals.filter((g) =>
        workout.goalKeys?.includes(g.goalKey),
      );
      if (linked.length)
        disclosure.body.prepend(
          user(
            make(
              "small",
              "aux-note",
              "Цели: " + linked.map((g) => g.name).join(", "),
            ),
          ),
        );
      disclosure.body.prepend(entries);
      row.append(
        check,
        copy,
        iconAction("ellipsis", "Действия с тренировкой", (event) => {
          const actions = [
            { label: "Изменить", run: () => openWorkout(workout) },
            {
              label: "Повторить",
              run: () => {
                openWorkout(workout);
                draft.id = null;
                updatePlansLabel.hidden = true;
                $("#workout-date").value = trainingDay;
                doneControl.checked = false;
                draft.entries = plannedWorkoutEntries(draft.entries);
                updateRepeatControls(true);
                renderDraftEntries();
                renderDraftGoals();
                workoutSave.textContent = "В план и расписание";
              },
            },
          ];
          if (workout.healthSource)
            actions.push({
              label: "Связать с планом",
              run: () => openLink(workout),
            });
          actions.push({ label: "Удалить", run: () => deleteWorkout(workout) });
          if (!workout.healthSource)
            actions.push({
              label: "Удалить несколько занятий…",
              run: () => openBatchDelete(workout),
            });
          showActions(actions);
        }),
      );
      planList.append(row);
    }
    if (list.length > visibleRows)
      planList.append(
        action(
          "Показать ещё",
          () => {
            visibleRows += 40;
            renderPlan();
          },
          "button",
        ),
      );
    refreshIcons();
    paintQuickResults();
  }
  function deleteWorkout(workout) {
    const data = snapshot(),
      events = data.events.filter((e) => e.workoutId === workout.id);
    const settings = prefs();
    if (workout.healthSource) {
      settings.ignoredWorkouts ||= [];
      settings.ignoredWorkouts.push(
        workout.healthSource.key,
        ...(workout.healthAliases || []),
      );
    }
    ctx.removeWithUndo(data.workouts, workout, () => {
      const restored = data.workouts.includes(workout);
      for (const event of events) {
        const at = data.events.indexOf(event);
        if (restored && at < 0) data.events.push(event);
        if (!restored && at >= 0) data.events.splice(at, 1);
      }
      if (restored && workout.healthSource)
        settings.ignoredWorkouts = (settings.ignoredWorkouts || []).filter(
          (key) =>
            ![
              workout.healthSource.key,
              ...(workout.healthAliases || []),
            ].includes(key),
        );
      refresh();
    });
  }
  const planUpdateForm = dialog(
      "training-plan-update-dialog",
      "Обновить запланированные занятия",
    ),
    planUpdateSource = make("p", "aux-note"),
    planUpdateScope = select(
      "Какие занятия обновить",
      "training-plan-update-scope",
      [
        ["series", "Эта серия"],
        ["name", "С таким же названием"],
        ["all", "Выбрать из всех занятий"],
      ],
    ),
    planUpdateDates = make("div", "field-row"),
    planUpdateList = make("div", "training-batch-list"),
    planUpdateCount = make("p", "aux-note"),
    planUpdateError = make("p", "error"),
    planUpdateSelected = new Set();
  planUpdateCount.setAttribute("aria-live", "polite");
  planUpdateDates.append(
    field("С даты", "training-plan-update-from", "date"),
    field("По дату", "training-plan-update-until", "date"),
  );
  let planUpdateSourceValue = null,
    planUpdateName = "",
    planUpdateVisible = 100;
  function planUpdatePeriod() {
    return {
      scope: $("#training-plan-update-scope").value,
      name: planUpdateName,
      from: $("#training-plan-update-from").value,
      until: $("#training-plan-update-until").value,
    };
  }
  function planUpdateCandidates() {
    const period = planUpdatePeriod();
    if (
      !planUpdateSourceValue ||
      !period.from ||
      !period.until ||
      period.from < today() ||
      period.until < period.from
    )
      return [];
    return workoutUpdateRows(
      snapshot().workouts,
      planUpdateSourceValue,
      period,
    );
  }
  const planUpdateAll = action(
    "Выбрать все",
    () => {
      const rows = planUpdateCandidates(),
        all = rows.every((row) => planUpdateSelected.has(row.trainingKey));
      planUpdateSelected.clear();
      if (!all) for (const row of rows) planUpdateSelected.add(row.trainingKey);
      renderPlanUpdate();
    },
    "text-button",
  );
  planUpdateForm.append(
    planUpdateSource,
    make(
      "p",
      "aux-note",
      "Заменятся все упражнения, их порядок, число подходов и плановые значения. Даты, время и длительность останутся прежними. Выполненные занятия, записи часов и занятия с введёнными результатами пропускаются.",
    ),
    planUpdateScope,
    planUpdateDates,
    planUpdateAll,
    planUpdateCount,
    planUpdateList,
    planUpdateError,
  );
  const planUpdateSubmit = saveRow(planUpdateForm, "Обновить упражнения");
  function renderPlanUpdate() {
    const rows = planUpdateCandidates(),
      allowed = new Set(rows.map((row) => row.trainingKey));
    for (const key of planUpdateSelected)
      if (!allowed.has(key)) planUpdateSelected.delete(key);
    planUpdateList.replaceChildren();
    updatePlanSelection(rows);
    for (const workout of rows.slice(0, planUpdateVisible)) {
      const label = make("label", "training-batch-option"),
        input = make("input");
      input.type = "checkbox";
      input.checked = planUpdateSelected.has(workout.trainingKey);
      input.dataset.updateWorkout = workout.trainingKey;
      label.append(
        input,
        user(
          make(
            "span",
            "",
            ctx.shortDate(workout.date) +
              " · " +
              workout.time +
              " · " +
              workout.name +
              " · " +
              (workout.entries || []).length +
              " → " +
              planUpdateSourceValue.entries.length +
              " упр.",
          ),
        ),
      );
      listen(input, "change", () => {
        if (input.checked) planUpdateSelected.add(workout.trainingKey);
        else planUpdateSelected.delete(workout.trainingKey);
        updatePlanSelection(rows);
      });
      planUpdateList.append(label);
    }
    if (!rows.length)
      planUpdateList.append(
        make(
          "p",
          "aux-note",
          "Подходящих запланированных занятий нет. Измените период или выберите другой список.",
        ),
      );
    if (rows.length > planUpdateVisible)
      planUpdateList.append(
        action(
          "Показать ещё",
          () => {
            planUpdateVisible += 100;
            renderPlanUpdate();
          },
          "text-button",
        ),
      );
  }
  function updatePlanSelection(rows) {
    planUpdateCount.textContent =
      "Доступно: " + rows.length + " · Выбрано: " + planUpdateSelected.size;
    planUpdateSubmit.textContent =
      "Обновить упражнения · " + planUpdateSelected.size;
    planUpdateSubmit.disabled =
      !planUpdateSelected.size || !planUpdateSourceValue?.entries?.length;
    planUpdateAll.textContent =
      rows.length &&
      rows.every((row) => planUpdateSelected.has(row.trainingKey))
        ? "Снять выделение"
        : "Выбрать все · " + rows.length;
  }
  function openPlanUpdate(source, referenceName = source.name) {
    planUpdateSourceValue = structuredClone(source);
    planUpdateName = referenceName;
    planUpdateVisible = 100;
    planUpdateSelected.clear();
    const scope = $("#training-plan-update-scope");
    scope.querySelector('[value="series"]').disabled = !source.seriesKey;
    scope.value = source.seriesKey ? "series" : "name";
    const from = $("#training-plan-update-from"),
      until = $("#training-plan-update-until");
    from.min = until.min = today();
    from.value = today();
    until.value = snapshot().workouts.reduce(
      (max, row) => (row.date > max ? row.date : max),
      from.value,
    );
    planUpdateSource.textContent =
      "Образец: " +
      source.name +
      " · Упражнений: " +
      (source.entries || []).length;
    planUpdateError.hidden = Boolean(source.entries?.length);
    planUpdateError.textContent =
      "Добавьте хотя бы одно упражнение в исходное занятие.";
    for (const row of planUpdateCandidates())
      planUpdateSelected.add(row.trainingKey);
    renderPlanUpdate();
    ctx.openDialog("training-plan-update-dialog");
  }
  for (const input of [
    planUpdateScope.querySelector("select"),
    ...planUpdateDates.querySelectorAll("input"),
  ])
    listen(input, "change", () => {
      planUpdateSelected.clear();
      planUpdateVisible = 100;
      renderPlanUpdate();
    });
  listen(planUpdateForm, "submit", (event) => {
    event.preventDefault();
    if (!planUpdateForm.reportValidity() || !planUpdateSelected.size) return;
    try {
      const allowed = new Set(
        planUpdateCandidates().map((row) => row.trainingKey),
      );
      const changes = updateWorkoutPlans(
        snapshot(),
        planUpdateSourceValue,
        [...planUpdateSelected].filter((key) => allowed.has(key)),
        planUpdatePeriod(),
      );
      if (!changes.length) {
        renderPlanUpdate();
        return;
      }
      ctx.closeDialog();
      refresh();
      ctx.notify("Обновлено занятий: " + changes.length, () => {
        const restored = undoWorkoutPlans(snapshot(), changes);
        refresh();
        ctx.notify("Отменено обновлений: " + restored);
      });
    } catch (error) {
      planUpdateError.textContent = error.message || String(error);
      planUpdateError.hidden = false;
    }
  });
  const batchForm = dialog(
      "training-batch-delete-dialog",
      "Удалить занятия из расписания",
    ),
    batchGroupField = select("Какие занятия", "training-batch-group", []),
    batchDates = make("div", "field-row"),
    batchDone = make("label", "training-batch-done"),
    batchDoneInput = make("input"),
    batchList = make("div", "training-batch-list"),
    batchCount = make("p", "aux-note"),
    batchSelected = new Set();
  batchDoneInput.type = "checkbox";
  batchDoneInput.id = "training-batch-include-done";
  batchDone.append(
    batchDoneInput,
    make("span", "", "Включить выполненные занятия"),
  );
  batchDates.append(
    field("С даты", "training-batch-from", "date"),
    field("По дату", "training-batch-until", "date"),
  );
  const batchSelectAll = action(
    "Выбрать все",
    () => {
      const rows = batchCandidates();
      const all = rows.every((w) => batchSelected.has(w.trainingKey));
      batchSelected.clear();
      if (!all) for (const w of rows) batchSelected.add(w.trainingKey);
      renderBatchDelete();
    },
    "text-button",
  );
  batchForm.append(
    make(
      "p",
      "aux-note",
      "Будут удалены выбранные занятия и их события в расписании. Результаты выполненных занятий по умолчанию сохраняются. Удаление можно отменить.",
    ),
    batchGroupField,
    batchDates,
    batchDone,
    batchSelectAll,
    batchCount,
    batchList,
  );
  const batchSubmit = action(
    "Удалить выбранные",
    () => {},
    "button button-danger",
  );
  batchSubmit.type = "submit";
  const batchActions = make("div", "dialog-actions");
  batchActions.append(action("Отмена", ctx.closeDialog, "button"), batchSubmit);
  batchForm.append(batchActions);
  let batchVisible = 100;
  function batchCandidates() {
    return workoutBatchRows(snapshot().workouts, {
      group: $("#training-batch-group").value,
      from: $("#training-batch-from").value,
      until: $("#training-batch-until").value,
      includeDone: batchDoneInput.checked,
    });
  }
  function renderBatchDelete() {
    const rows = batchCandidates(),
      allowed = new Set(rows.map((w) => w.trainingKey));
    for (const key of batchSelected)
      if (!allowed.has(key)) batchSelected.delete(key);
    batchList.replaceChildren();
    batchCount.textContent =
      "Найдено: " + rows.length + " · Выбрано: " + batchSelected.size;
    batchSubmit.disabled = !batchSelected.size;
    batchSubmit.textContent = "Удалить выбранные · " + batchSelected.size;
    batchSelectAll.textContent =
      rows.length && rows.every((w) => batchSelected.has(w.trainingKey))
        ? "Снять выделение"
        : "Выбрать все · " + rows.length;
    for (const workout of rows.slice(0, batchVisible)) {
      const label = make("label", "training-batch-option"),
        input = make("input");
      input.type = "checkbox";
      input.checked = batchSelected.has(workout.trainingKey);
      input.dataset.batchWorkout = workout.trainingKey;
      label.append(
        input,
        user(
          make(
            "span",
            "",
            ctx.shortDate(workout.date) +
              " · " +
              workout.time +
              " · " +
              workout.name +
              (workout.done ? " · выполнено" : ""),
          ),
        ),
      );
      listen(input, "change", () => {
        if (input.checked) batchSelected.add(workout.trainingKey);
        else batchSelected.delete(workout.trainingKey);
        renderBatchDelete();
      });
      batchList.append(label);
    }
    if (!rows.length)
      batchList.append(
        make("p", "aux-note", "В этом периоде подходящих занятий нет."),
      );
    if (rows.length > batchVisible)
      batchList.append(
        action(
          "Показать ещё",
          () => {
            batchVisible += 100;
            renderBatchDelete();
          },
          "text-button",
        ),
      );
    refreshIcons();
  }
  function openBatchDelete(workout = null) {
    batchSelected.clear();
    batchVisible = 100;
    const picker = $("#training-batch-group");
    picker.replaceChildren(make("option", "", "Все занятия"));
    picker.firstChild.value = "";
    const groups = new Map();
    for (const row of snapshot().workouts.filter((w) => !w.healthSource)) {
      const key = workoutGroup(row),
        group = groups.get(key) || {
          name: row.name,
          count: 0,
          from: row.date,
          until: row.date,
        };
      group.count++;
      if (row.date < group.from) group.from = row.date;
      if (row.date > group.until) group.until = row.date;
      groups.set(key, group);
    }
    for (const [key, group] of groups) {
      const option = user(
        make(
          "option",
          "",
          group.name +
            " · " +
            group.count +
            " · " +
            ctx.shortDate(group.from) +
            " — " +
            ctx.shortDate(group.until),
        ),
      );
      option.value = key;
      picker.append(option);
    }
    picker.value = workout ? workoutGroup(workout) : "";
    $("#training-batch-from").value = workout?.date || trainingDay;
    $("#training-batch-until").value = snapshot().workouts.reduce(
      (max, w) => (w.date > max ? w.date : max),
      $("#training-batch-from").value,
    );
    batchDoneInput.checked = false;
    renderBatchDelete();
    ctx.openDialog("training-batch-delete-dialog");
  }
  for (const input of [
    batchGroupField.querySelector("select"),
    ...batchDates.querySelectorAll("input"),
    batchDoneInput,
  ])
    listen(input, "change", () => {
      batchSelected.clear();
      batchVisible = 100;
      renderBatchDelete();
    });
  listen(batchForm, "submit", (event) => {
    event.preventDefault();
    if (!batchForm.reportValidity()) return;
    const keys = batchCandidates()
      .filter((w) => batchSelected.has(w.trainingKey))
      .map((w) => w.trainingKey);
    // The selection dialog and counted destructive button are the confirmation.
    // Avoid an extra platform JS alert, which varies across Android WebViews.
    if (!keys.length) return;
    const removed = removeWorkoutBatch(snapshot(), keys);
    ctx.closeDialog();
    refresh();
    ctx.notify("Удалено занятий: " + removed.workouts.length, () => {
      restoreWorkoutBatch(snapshot(), removed);
      refresh();
    });
  });
  const linkForm = dialog(
    "training-link-dialog",
    "Связать запись часов с планом",
  );
  const linkSelect = select(
    "Запланированная тренировка в этот день",
    "training-link-target",
    [],
  );
  linkForm.append(
    make(
      "p",
      "aux-note",
      "Запись часов объединится с выбранной тренировкой. Упражнения и цели плана сохранятся.",
    ),
    linkSelect,
  );
  saveRow(linkForm, "Связать");
  let linkingWorkout = null;
  function openLink(workout) {
    linkingWorkout = workout;
    const picker = $("#training-link-target");
    picker.required = true;
    picker.replaceChildren(make("option", "", "Выберите тренировку"));
    picker.firstChild.value = "";
    for (const target of snapshot().workouts.filter(
      (w) => w !== workout && w.date === workout.date && !w.healthSource,
    )) {
      const option = user(
        make("option", "", target.time + " · " + target.name),
      );
      option.value = target.trainingKey;
      picker.append(option);
    }
    ctx.openDialog("training-link-dialog");
  }
  listen(linkForm, "submit", (event) => {
    event.preventDefault();
    if (!linkForm.reportValidity()) return;
    const data = snapshot(),
      target = data.workouts.find(
        (w) => w.trainingKey === $("#training-link-target").value,
      );
    const source = data.workouts.find((w) => w === linkingWorkout);
    if (!target || !source) return;
    const previous = structuredClone(target),
      sourceIndex = data.workouts.indexOf(source),
      sourceEvents = data.events.filter(
        (event) => event.workoutId === source.id,
      );
    const entries = structuredClone(target.entries || []);
    for (const result of source.entries || []) {
      const entry = entries.find(
        (item) =>
          item.exerciseKey === result.exerciseKey && item.unit === result.unit,
      );
      if (!entry) entries.push(structuredClone(result));
      else if (Number.isFinite(result.value))
        Object.assign(entry, {
          value: result.value,
          ...(result.sets ? { sets: result.sets } : {}),
        });
    }
    if (entries.length > 200) {
      ctx.notify("Слишком много упражнений для одной тренировки.");
      return;
    }
    Object.assign(target, {
      done: Boolean(source.done),
      completedAt: source.completedAt,
      healthSource: source.healthSource,
      healthAliases: source.healthAliases || [],
      steps: source.steps,
      linkedPlan: true,
      entries,
      goalKeys: [
        ...new Set([...(target.goalKeys || []), ...(source.goalKeys || [])]),
      ],
      win: Boolean(target.win || source.win),
      result: [...new Set([target.result, source.result].filter(Boolean))].join(
        "\n",
      ),
    });
    data.workouts.splice(sourceIndex, 1);
    for (const event of sourceEvents)
      data.events.splice(data.events.indexOf(event), 1);
    syncEvent(target);
    ctx.closeDialog();
    refresh();
    ctx.notify("Запись часов связана с тренировкой", () => {
      Object.keys(target).forEach((key) => delete target[key]);
      Object.assign(target, previous);
      data.workouts.splice(sourceIndex, 0, source);
      for (const event of sourceEvents)
        if (!data.events.includes(event)) data.events.push(event);
      syncEvent(target);
      refresh();
    });
  });

  // A compact daily counter and seven-day history live inside Training.
  const stepsForm = dialog("steps-edit-dialog", "Шаги за день");
  stepsForm.append(
    field("Дата", "steps-edit-date", "date"),
    numeric("Количество шагов", "steps-edit-count", 0, 200000, "1"),
    make(
      "p",
      "aux-note",
      "Ручная запись имеет приоритет над импортом за этот день.",
    ),
  );
  const resetSteps = action(
    "Вернуть автоматические данные",
    async () => {
      const row = snapshot().stepLogs.find(
        (r) => r.date === $("#steps-edit-date").value,
      );
      if (row) {
        row.manualOverride = false;
        ctx.persistState();
      }
      ctx.closeDialog();
      await syncHealth(true);
      renderSteps();
    },
    "text-button",
  );
  stepsForm.append(resetSteps);
  saveRow(stepsForm, "Сохранить");
  function openSteps() {
    const date = stepDate.value || today(),
      row = snapshot().stepLogs.find((r) => r.date === date);
    $("#steps-edit-date").value = date;
    $("#steps-edit-count").value = String(row?.count || 0);
    resetSteps.hidden = !row?.manualOverride || !prefs().enabled;
    ctx.openDialog("steps-edit-dialog");
  }
  listen(stepsForm, "submit", (event) => {
    event.preventDefault();
    if (!stepsForm.reportValidity()) return;
    const data = snapshot(),
      date = $("#steps-edit-date").value;
    const row = data.stepLogs.find((r) => r.date === date);
    const values = {
      date,
      count: Number($("#steps-edit-count").value),
      source: "manual",
      manualOverride: true,
    };
    if (row) Object.assign(row, values);
    else data.stepLogs.push(values);
    stepDate.value = date;
    ctx.closeDialog();
    refresh();
  });
  function renderSteps(forceAlign = false) {
    const date = stepDate.value || today(),
      rows = matchingStepDays(snapshot().stepLogs, snapshot());
    const count = dailySteps(rows, date);
    stepTotal.replaceChildren();
    stepTotal.append(
      make(
        "strong",
        "",
        count === null ? "—" : count.toLocaleString(ctx.displayLocale()),
      ),
      make(
        "small",
        "aux-note",
        count === null ? "Добавить или подключить" : "шагов · изменить",
      ),
    );
    stepHistory.render(rows, date, forceAlign);
    const row = rows.find((r) => r.date === date);
    stepSource.textContent = row?.manualOverride
      ? "Ручная запись"
      : row?.source === "health-connect"
        ? "Из Health Connect · телефон и часы учитываются без сложения дублей"
        : "Шаги появятся после подключения Health Connect или ручной записи.";
    if (!row && snapshot().stepLogs.some((r) => r.date === date))
      stepSource.textContent =
        "Начало дня изменено. Обновите Health Connect для пересчёта шагов.";
    if (ctx.isIllDay(date))
      stepSource.textContent +=
        " · Период болезни: без оценки выполнения цели.";
    if (!$("#training-step-stats-dialog").hidden) renderStepStatistics();
    refreshIcons();
  }

  // Read-only Health Connect: user opts in once; refresh while foregrounded.
  const healthForm = dialog("health-connect-dialog", "Данные телефона и часов");
  healthForm.append(
    make(
      "p",
      "aux-note",
      "Orvim читает выбранные данные из Health Connect. Подключите к нему приложение часов. Импорт обновляется при открытии Orvim и раз в 5 минут, пока приложение открыто.",
    ),
  );
  const healthFields = make("div", "health-category-options");
  for (const [key, label] of [
    ["steps", "Шаги → Тренировки"],
    ["sleep", "Длительность сна → Сон"],
    ["workouts", "Тренировки → Тренировки"],
  ]) {
    const row = make("label", "training-check-label"),
      input = make("input");
    input.type = "checkbox";
    input.id = "health-read-" + key;
    row.append(input, make("span", "", label));
    healthFields.append(row);
    listen(input, "change", () => {
      prefs()[key] = input.checked;
      ctx.persistState();
    });
  }
  const healthMessage = make("p", "health-status");
  healthMessage.setAttribute("role", "status");
  const healthTime = make("p", "aux-note");
  const healthButtons = make("div", "training-actions");
  const connect = action("Подключить", connectHealth, "button button-primary");
  const sync = action("Обновить", () => syncHealth(true), "button");
  const manage = action(
    "Разрешения Android",
    async () => {
      try {
        await ctx.services.platform("healthSettings", {});
      } catch (error) {
        healthMessage.textContent = String(error);
      }
    },
    "text-button",
  );
  const disconnect = action(
    "Отключить импорт",
    () => {
      prefs().enabled = false;
      ctx.persistState();
      renderHealth();
    },
    "text-button",
  );
  healthButtons.append(connect, sync, manage, disconnect);
  healthForm.append(
    healthFields,
    healthMessage,
    healthTime,
    healthButtons,
    make(
      "p",
      "aux-note",
      "Только чтение шагов, сна и тренировок. Без доступа к пульсу, геолокации и маршрутам. Отключение импорта сохраняет уже полученную историю.",
    ),
  );
  const settingsCard = action("", openHealth, "settings-connection-choice");
  const settingsCopy = make("span", "settings-card-copy");
  settingsCopy.append(
    make("strong", "", "Телефон и часы"),
    make(
      "small",
      "aux-note",
      "Health Connect: шаги, сон и тренировки · Android",
    ),
  );
  settingsCard.append(icon("heart"), settingsCopy, icon("chevron-right"));
  $(".settings-connection-choices")?.append(settingsCard);
  async function openHealth() {
    renderHealth();
    ctx.openDialog("health-connect-dialog");
    if (!ctx.services.platform) return;
    try {
      healthStatus = await ctx.services.platform("healthStatus", {});
    } catch {
      healthStatus = {
        status: "unsupported",
        message:
          "Health Connect подключается в Android-приложении. На ПК видна синхронизированная история.",
      };
    }
    if (!disposed) renderHealth();
  }
  function renderHealth() {
    const settings = prefs();
    for (const key of ["steps", "sleep", "workouts"])
      $("#health-read-" + key).checked = settings[key];
    const unavailable = healthStatus && healthStatus.status !== "available";
    connect.disabled = busy || healthStatus?.status === "unsupported";
    connect.textContent =
      healthStatus?.status === "install"
        ? "Установить Health Connect"
        : "Разрешить выбранные данные";
    sync.disabled = busy || !settings.enabled || Boolean(unavailable);
    manage.disabled = busy || Boolean(unavailable);
    disconnect.hidden = !settings.enabled;
    healthMessage.textContent = busy
      ? "Получаем данные…"
      : healthStatus?.message ||
        (settings.enabled
          ? "Автоматический импорт включён"
          : "Автоматический импорт выключен");
    healthTime.textContent = settings.lastSync
      ? "Последнее обновление: " +
        new Date(settings.lastSync).toLocaleString(ctx.displayLocale())
      : "";
    refreshIcons();
    ctx.fitDialog();
  }
  function selectedCategories() {
    return ["steps", "sleep", "workouts"].filter((key) => prefs()[key]);
  }
  async function connectHealth() {
    if (busy || !ctx.services.platform) return;
    if (!selectedCategories().length) {
      healthMessage.textContent = "Выберите хотя бы один вид данных.";
      return;
    }
    if (healthStatus?.status === "install") {
      await ctx.services.platform("healthInstall", {}).catch((e) => {
        healthMessage.textContent = String(e);
      });
      return;
    }
    busy = true;
    renderHealth();
    try {
      healthStatus = await ctx.services.platform("healthPermission", {
        categories: selectedCategories(),
      });
      if (disposed) return;
      prefs().enabled = selectedCategories().some((key) =>
        healthStatus.granted?.includes(key),
      );
      ctx.persistState();
    } catch (error) {
      healthStatus = { status: "available", message: String(error) };
    } finally {
      busy = false;
      if (!disposed) renderHealth();
    }
    if (!disposed && prefs().enabled) await syncHealth(true);
  }
  let dayRefreshPending = false,
    dayRefreshQueued = false,
    observedDayStart = lifeDayStart(snapshot());
  function requestDayRefresh() {
    if (dayRefreshQueued || disposed) return;
    dayRefreshQueued = true;
    queueMicrotask(() => {
      dayRefreshQueued = false;
      if (disposed) return;
      if (busy) {
        dayRefreshPending = true;
        return;
      }
      void syncHealth(true);
    });
  }
  async function syncHealth(force = false) {
    if (
      disposed ||
      busy ||
      !prefs().enabled ||
      !selectedCategories().length ||
      !ctx.services.platform ||
      (!force &&
        (Date.now() - lastAttempt < 300000 ||
          ctx.hasDialog() ||
          document.hidden))
    )
      return;
    lastAttempt = Date.now();
    busy = true;
    renderHealth();
    const requestedDayStart = lifeDayStart(snapshot());
    try {
      const result = await ctx.services.platform("healthRead", {
        dayStartMinutes: requestedDayStart,
        categories: selectedCategories(),
        days: 30,
      });
      if (disposed || !prefs().enabled) return;
      if (requestedDayStart !== lifeDayStart(snapshot())) {
        dayRefreshPending = true;
        return;
      }
      // Native output has bounded records. Never forward it to AI automatically.
      const summary = mergeHealthData(
        snapshot(),
        result,
        ctx.createId,
        prefs(),
      );
      if (result.granted?.length) prefs().lastSync = result.at || Date.now();
      healthStatus = {
        status: result.status || "available",
        granted: result.granted,
        message:
          result.message ||
          "Новых записей: " +
            summary.added +
            ". Обновлено: " +
            summary.updated +
            (summary.protectedCount
              ? ". Ручные записи сохранены: " + summary.protectedCount
              : "") +
            (result.warnings?.length ? ". " + result.warnings.join(". ") : ""),
      };
      refresh();
      await ctx.services.flush();
    } catch (error) {
      healthStatus = {
        status: "available",
        message: "Не удалось обновить данные. " + String(error),
      };
    } finally {
      busy = false;
      if (!disposed) renderHealth();
      if (!disposed && dayRefreshPending) {
        dayRefreshPending = false;
        queueMicrotask(() => void syncHealth(true));
      }
    }
  }
  const resume = () => {
    if (!document.hidden) void syncHealth();
  };
  listen(document, "visibilitychange", resume);
  listen(window, "life-os:resume", resume);
  const timer = window.setInterval(() => void syncHealth(), 300000);
  queueMicrotask(() => void syncHealth());
  function render() {
    if (disposed) return;
    const dayStart = lifeDayStart(snapshot());
    if (observedDayStart !== dayStart) {
      observedDayStart = dayStart;
      requestDayRefresh();
    }
    normalizeTraining(snapshot());
    renderSteps();
    renderGoals();
    renderPlan();
  }
  render();
  return {
    render,
    rehydrate: render,
    refreshDayBoundary() {
      render();
      requestDayRefresh();
    },
    resetToday() {
      trainingDay = today();
      dayDate.value = trainingDay;
      stepDate.value = trainingDay;
      month.value = trainingDay.slice(0, 7);
      dayAlignmentNeeded = true;
    },
    openWorkout,
    openResults,
    toggleCompletion,
    mountQuickResults,
    mountCompactResults,
    unschedule(event) {
      const workout = snapshot().workouts.find((w) => w.id === event.workoutId);
      if (workout) deleteWorkout(workout);
      else ctx.removeWithUndo(snapshot().events, event, refresh);
    },
    dispose() {
      disposed = true;
      window.clearInterval(timer);
      window.clearTimeout(dayScrollTimer);
      planAnimation?.cancel();
      stepHistory.dispose();
      session.dispose();
      openWorkouts.clear();
    },
  };
}
