import { createRatingPicker } from "./rating.js";
import { wellbeingSlots } from "./wellbeing.js";
import { installCustomFonts } from "./custom-fonts.js";

export function installRefinements(ctx) {
  const { $, make, action, listen } = ctx;
  const icon = (name) => {
    const node = make("i");
    node.dataset.lucide = name;
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  function iconButton(button, name, label) {
    button.replaceChildren(icon(name));
    button.classList.add("refinement-icon");
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  iconButton(
    $("#life-tracking-settings"),
    "sliders-horizontal",
    "Настроить питание",
  );

  // Keep the original value field and save handler; rating remains a draft.
  const oldQuality = $("#sleep-quality"),
    quality = make("input");
  quality.id = oldQuality.id;
  quality.type = "hidden";
  quality.value = oldQuality.value;
  oldQuality.replaceWith(quality);
  const moon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 13.1A8.8 8.8 0 0 1 10.9 3.5a8.8 8.8 0 1 0 9.6 9.6Z"/></svg>';
  const sleepRating = createRatingPicker(ctx, {
    maximum: 5,
    step: 1,
    glyph: moon,
    value: Number(quality.value) || 0,
    onChange(value) {
      quality.value = value ? String(value) : "";
    },
  });
  sleepRating.element.classList.add("sleep-moon-rating");
  sleepRating.element
    .querySelector('[role="slider"]')
    .setAttribute("aria-label", "Качество сна");
  quality.after(sleepRating.element);
  listen(quality, "change", () =>
    sleepRating.update(Number(quality.value) || 0),
  );

  // Finance filters stay available without taking space above the main totals.
  const financeHead = $("#life-finances-view .life-panel-head"),
    controls = make("details", "finance-options"),
    summary = make("summary", "refinement-icon"),
    body = make("div", "finance-options-body");
  controls.id = "finance-options";
  summary.append(icon("sliders-horizontal"));
  summary.setAttribute(
    "aria-label",
    "Настройки финансов: период, валюта и счета",
  );
  summary.title = "Период, валюта и счета";
  for (const selector of [
    ".finance-period",
    ".finance-account-tools",
    ".finance-account-strip",
  ])
    if ($(selector)) body.append($(selector));
  controls.append(summary, body);
  financeHead.append(controls);
  const quick = make("div", "finance-quick-add");
  quick.append($("#finance-add"));
  $("#finance-totals").after(quick);

  // Icons complement labels, so settings remain understandable and accessible.
  for (const [selector, name] of [
    ['button[data-appearance="system"]', "monitor"],
    ['button[data-appearance="light"]', "sun"],
    ['button[data-appearance="dark"]', "moon"],
    ['[data-theme="sun"]', "sun"],
    ['[data-theme="pine"]', "trees"],
    ['[data-theme="scarlet"]', "flame"],
    ['[data-theme="winter"]', "snowflake"],
  ]) {
    const button = $(selector);
    button.querySelector(".swatch")?.remove();
    const caption = make(
      "span",
      "appearance-choice-label",
      button.textContent.trim(),
    );
    const badge = make("span", "appearance-choice-icon");
    badge.append(icon(name));
    button.replaceChildren(badge, caption);
    button.classList.add("appearance-icon-choice");
  }
  $(".custom-theme > span").prepend(icon("palette"));

  const notifications = $(".settings-notifications"),
    countLabel = make("label", "field wellbeing-frequency"),
    count = make("select"),
    hint = make("small", "aux-note");
  count.id = "wellbeing-daily-count";
  countLabel.append(make("span", "", "Самочувствие · раз в день"), count, hint);
  for (let n = 1; n <= 6; n++) {
    const option = make("option", "", String(n));
    option.value = String(n);
    count.append(option);
  }
  const prefs = () => ctx.extraState.notificationSettings;
  function refreshCount() {
    const value = prefs().wellbeingCount;
    count.value = String(
      Number.isInteger(value) && value >= 1 && value <= 6 ? value : 3,
    );
    hint.textContent = wellbeingSlots(Number(count.value))
      .map((s) => String(s.hour).padStart(2, "0") + ":00")
      .join(" · ");
  }
  refreshCount();
  $("#notifications-wellbeing").closest(".settings-card").after(countLabel);
  listen(count, "change", () => {
    prefs().wellbeingCount = Number(count.value);
    refreshCount();
    ctx.persistState();
    ctx.refreshHomeStatus();
  });
  const timerRow = make("div", "settings-card notification-choice"),
    timerLabel = make("label", "notification-toggle"),
    timer = make("input"),
    copy = make("span", "settings-card-copy");
  timer.id = "notifications-timer-sound";
  timer.type = "checkbox";
  timer.checked = prefs().timerSound !== false;
  copy.append(
    make("strong", "", "Звук таймера тренировки"),
    make("span", "aux-note", "По окончании отдыха между подходами"),
  );
  timerLabel.append(timer, copy);
  const audio = new Audio("/sounds/training/rest-ready.wav");
  const preview = action(
    "Прослушать",
    async () => {
      audio.pause();
      audio.currentTime = 0;
      try {
        await audio.play();
      } catch {
        ctx.notify("Не удалось прослушать звук");
      }
    },
    "text-button",
  );
  timerRow.append(timerLabel, preview);
  notifications.append(timerRow);
  listen(timer, "change", () => {
    prefs().timerSound = timer.checked;
    audio.pause();
    ctx.persistState();
  });
  const fonts = installCustomFonts(ctx);
  ctx.services.refreshIcons(ctx.root);
  return {
    rehydrate() {
      refreshCount();
      timer.checked = prefs().timerSound !== false;
    },
    dispose() {
      audio.pause();
      fonts.dispose();
    },
  };
}
