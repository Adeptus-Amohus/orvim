export function installRestTimer(ctx) {
  const { make, action, listen } = ctx;
  const prefs = () => ctx.extraState.uiPreferences;
  const t = (ru, en) => ctx.translate(ru, en);
  let end = 0,
    duration = 0,
    pointer = null,
    target = null,
    persistTarget = true,
    activeWorkout = null,
    returnTo = null;
  const format = (seconds) =>
    Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  prefs().restSeconds ??= 90;
  const sound = new Audio("/sounds/training/rest-ready.wav");
  sound.preload = "auto";
  sound.volume = 0.45;
  function settings(workout = {}) {
    workout ||= {};
    const seconds = workout.restSeconds ?? prefs().restSeconds ?? 90;
    return {
      restSeconds: Number.isFinite(seconds)
        ? Math.max(5, Math.min(300, Math.round(seconds)))
        : 90,
      restAutomatic: (workout.restAutomatic ?? prefs().restAutomatic) !== false,
      restSound:
        ctx.extraState.notificationSettings?.timerSound !== false &&
        (workout.restSound ?? prefs().restSound) !== false,
    };
  }
  function currentTarget() {
    const value = typeof target === "function" ? target() : target;
    if (!value?.trainingKey) return value;
    return ctx
      .snapshotData()
      .workouts.find((workout) => workout.trainingKey === value.trainingKey);
  }
  function updateSettings(values) {
    const workout = currentTarget();
    if (!workout) return;
    Object.assign(workout, values);
    if (persistTarget) ctx.persistState();
  }
  function primeSound(workout) {
    if (!settings(workout).restSound) return;
    sound.muted = true;
    const play = sound.play();
    play
      ?.then(() => {
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
      })
      .catch(() => {
        sound.muted = false;
      });
  }
  function iconButton(callback) {
    const button = action("", callback, "training-timer-icon");
    button.setAttribute(
      "aria-label",
      t("Отдых между подходами", "Rest between sets"),
    );
    button.title = t("Отдых между подходами", "Rest between sets");
    const icon = make("i");
    icon.dataset.lucide = "timer";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
    return button;
  }
  function ring(className) {
    const host = make("div", className),
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("aria-hidden", "true");
    let fill;
    for (const foreground of [false, true]) {
      const circle = document.createElementNS(svg.namespaceURI, "circle");
      for (const [key, value] of Object.entries({
        cx: 60,
        cy: 60,
        r: 51,
        fill: "none",
        stroke: foreground ? "var(--lo-accent)" : "var(--lo-line)",
        "stroke-width": 5,
        "stroke-linecap": "round",
      }))
        circle.setAttribute(key, String(value));
      if (foreground) {
        circle.setAttribute("transform", "rotate(-90 60 60)");
        fill = circle;
      }
      svg.append(circle);
    }
    const value = make("strong", "rest-ring-value");
    host.append(svg, value);
    return {
      host,
      paint(seconds, portion) {
        value.textContent = format(seconds);
        fill.setAttribute(
          "stroke-dasharray",
          `${Math.max(0, portion) * 320.44} 320.44`,
        );
      },
    };
  }
  const active = ring("training-rest-ring"),
    rest = make("div", "training-rest");
  rest.hidden = true;
  const sessionName = make("small", "training-rest-session");
  sessionName.dataset.userContent = "";
  active.host.tabIndex = 0;
  active.host.setAttribute("role", "button");
  active.host.setAttribute("aria-label", t("Таймер занятия", "Session timer"));
  const openActive = () => {
    if (activeWorkout) open(active.host, activeWorkout);
  };
  listen(active.host, "click", openActive);
  listen(active.host, "keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openActive();
  });
  const status = make("small", "", t("Отдых", "Rest"));
  status.setAttribute("role", "status");
  const activeCopy = make("div", "training-rest-copy");
  activeCopy.append(sessionName, status);
  rest.append(
    active.host,
    activeCopy,
    action(
      "×",
      () => {
        end = 0;
        rest.hidden = true;
      },
      "close",
    ),
  );
  ctx.root.append(rest);
  const overlay = make("div", "overlay");
  overlay.id = "rest-timer-dialog";
  overlay.hidden = true;
  const dialog = make("div", "dialog rest-timer-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const heading = make("div", "dialog-head");
  const title = make("h2", "", t("Отдых между подходами", "Rest between sets"));
  title.id = "rest-timer-title";
  dialog.setAttribute("aria-labelledby", title.id);
  heading.append(title, action("×", ctx.closeDialog, "close"));
  const subtitle = make("p", "aux-note rest-session-name");
  subtitle.dataset.userContent = "";
  const dial = ring("rest-duration-dial");
  dial.host.tabIndex = 0;
  dial.host.setAttribute("role", "slider");
  for (const [key, value] of Object.entries({
    "aria-label": t(
      "Длительность отдыха в секундах",
      "Rest duration in seconds",
    ),
    "aria-valuemin": "5",
    "aria-valuemax": "300",
  }))
    dial.host.setAttribute(key, value);
  function paintDial() {
    const seconds = settings(currentTarget()).restSeconds;
    dial.paint(seconds, seconds / 300);
    dial.host.setAttribute("aria-valuenow", String(seconds));
    dial.host.setAttribute("aria-valuetext", format(seconds));
  }
  function setDuration(seconds) {
    updateSettings({
      restSeconds: Math.max(5, Math.min(300, Math.round(seconds / 5) * 5)),
    });
    paintDial();
  }
  function drag(event) {
    const bounds = dial.host.getBoundingClientRect();
    const angle =
      (Math.atan2(
        event.clientY - bounds.top - bounds.height / 2,
        event.clientX - bounds.left - bounds.width / 2,
      ) +
        Math.PI / 2 +
        2 * Math.PI) %
      (2 * Math.PI);
    setDuration((angle / (2 * Math.PI)) * 300);
  }
  listen(dial.host, "pointerdown", (event) => {
    pointer = event.pointerId;
    dial.host.setPointerCapture(pointer);
    drag(event);
  });
  listen(dial.host, "pointermove", (event) => {
    if (event.pointerId === pointer) drag(event);
  });
  listen(dial.host, "pointerup", () => {
    pointer = null;
  });
  listen(dial.host, "pointercancel", () => {
    pointer = null;
  });
  listen(dial.host, "keydown", (event) => {
    if (
      ![
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    setDuration(
      event.key === "Home"
        ? 5
        : event.key === "End"
          ? 300
          : settings(currentTarget()).restSeconds +
            (["ArrowUp", "ArrowRight"].includes(event.key) ? 5 : -5),
    );
  });
  const presets = make("div", "experience-chips");
  for (const seconds of [30, 60, 90, 120, 180])
    presets.append(
      action(format(seconds), () => setDuration(seconds), "experience-chip"),
    );
  const automatic = make("input"),
    audible = make("input");
  automatic.type = audible.type = "checkbox";
  const autoLabel = make("label", "experience-choice"),
    soundLabel = make("label", "experience-choice");
  autoLabel.append(
    automatic,
    make("span", "", t("Запускать после подхода", "Start after each set")),
  );
  soundLabel.append(
    audible,
    make("span", "", t("Звук по окончании", "Sound when finished")),
  );
  listen(automatic, "change", () => {
    updateSettings({ restAutomatic: automatic.checked });
  });
  listen(audible, "change", () => {
    updateSettings({ restSound: audible.checked });
    if (audible.checked) primeSound(currentTarget());
  });
  const preview = action(
    t("Прослушать звук", "Preview sound"),
    () => {
      sound.muted = false;
      sound.currentTime = 0;
      sound.play()?.catch(() => {});
    },
    "text-button rest-sound-preview",
  );
  const buttons = make("div", "dialog-actions");
  const startButton = action(
    t("Запустить", "Start"),
    () => {
      const workout = currentTarget();
      ctx.closeDialog();
      if (workout) beginRest(workout, true);
    },
    "button button-primary",
  );
  buttons.append(action(t("Закрыть", "Close"), ctx.closeDialog), startButton);
  dialog.append(
    heading,
    subtitle,
    dial.host,
    make(
      "small",
      "aux-note rest-dial-hint",
      t(
        "Потяните по кругу · от 5 с до 5 мин",
        "Drag around the circle · 5 sec to 5 min",
      ),
    ),
    presets,
    autoLabel,
    soundLabel,
    preview,
    buttons,
  );
  overlay.append(dialog);
  ctx.root.append(overlay);
  listen(overlay, "click", (event) => {
    if (event.target === overlay) ctx.closeDialog();
  });
  function open(button, workout, persist = true) {
    target = workout;
    persistTarget = persist;
    const current = currentTarget();
    if (!current) return;
    returnTo = ctx.root.querySelector(".overlay:not([hidden])");
    if (returnTo === overlay) returnTo = null;
    startButton.hidden = !persist;
    paintDial();
    subtitle.textContent =
      current.name || current.label || t("Таймер занятия", "Session timer");
    automatic.checked = settings(current).restAutomatic;
    audible.checked = settings(current).restSound;
    primeSound(current);
    ctx.openDialog(overlay.id, button);
  }
  const observer = new MutationObserver(() => {
    if (!overlay.hidden || !returnTo) return;
    const previous = returnTo;
    returnTo = null;
    if (
      previous.isConnected &&
      !ctx.root.querySelector(".overlay:not([hidden])")
    )
      ctx.openDialog(previous.id);
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  const timer = window.setInterval(() => {
    if (!end) return;
    if (
      activeWorkout?.trainingKey &&
      !ctx
        .snapshotData()
        .workouts.some((w) => w.trainingKey === activeWorkout.trainingKey)
    ) {
      end = 0;
      activeWorkout = null;
      rest.hidden = true;
      sound.pause();
      return;
    }
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    active.paint(remaining, remaining / duration);
    if (!remaining) {
      end = 0;
      status.textContent = t("Можно продолжать", "Ready for the next set");
      if (settings(activeWorkout || {}).restSound) {
        sound.muted = false;
        sound.currentTime = 0;
        sound.play()?.catch(() => {});
      }
    }
  }, 250);
  function beginRest(workout, manual = false) {
    if (!workout || (!manual && !settings(workout).restAutomatic)) return;
    activeWorkout = workout;
    duration = settings(workout).restSeconds;
    primeSound(workout);
    end = Date.now() + duration * 1000;
    rest.hidden = false;
    status.textContent = t("Отдых", "Rest");
    sessionName.textContent =
      workout.name || t("Таймер занятия", "Session timer");
    active.paint(duration, 1);
  }
  return {
    beginRest,
    settings,
    attach(host, workout, persist = true) {
      const button = iconButton(() => open(button, workout, persist));
      listen(button, "click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      host.append(button);
      ctx.services.refreshIcons(button);
      return button;
    },
    dispose() {
      observer.disconnect();
      window.clearInterval(timer);
      sound.pause();
      sound.removeAttribute("src");
    },
  };
}
