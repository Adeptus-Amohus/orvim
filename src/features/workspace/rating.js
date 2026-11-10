import { numberFormat } from "./formatters.js";
const starSvg =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z"/></svg>';

export function createRatingStars(
  ctx,
  value = 0,
  maximum = 5,
  glyph = starSvg,
) {
  const display = ctx.make("span", "rating-display");
  display.setAttribute("aria-label", value + " / " + maximum);
  for (let index = 0; index < 5; index++) {
    const star = ctx.make("span", "rating-star"),
      fill = ctx.make("span", "rating-star-fill");
    star.innerHTML = fill.innerHTML = glyph;
    star.style.setProperty(
      "--star-fill",
      Math.max(0, Math.min(1, (value / maximum) * 5 - index)) * 100 + "%",
    );
    star.append(fill);
    display.append(star);
  }
  return display;
}

// The control edits a draft. Its owner decides when to persist it.
export function createRatingPicker(ctx, options) {
  const { make, listen } = ctx,
    element = make("div", "rating-picker"),
    slider = make("div", "rating-slider"),
    output = make("output", "rating-value"),
    clear = make(
      "button",
      "text-button",
      ctx.translate("Без оценки", "Clear rating"),
    );
  let maximum = options.maximum || 5,
    value = options.value || 0,
    pointer = null;
  slider.tabIndex = 0;
  slider.setAttribute("role", "slider");
  slider.setAttribute("aria-label", ctx.translate("Оценка", "Rating"));
  slider.setAttribute("aria-valuemin", "0");
  clear.type = "button";
  element.append(slider, output, clear);
  function paint() {
    slider.replaceChildren(
      createRatingStars(ctx, value, maximum, options.glyph),
    );
    slider.setAttribute("aria-valuemax", String(maximum));
    slider.setAttribute("aria-valuenow", String(value));
    slider.setAttribute(
      "aria-valuetext",
      value ? value + " / " + maximum : ctx.translate("Без оценки", "Unrated"),
    );
    output.textContent = value
      ? numberFormat(ctx.displayLocale()).format(value) + " / " + maximum
      : ctx.translate("Без оценки", "Unrated");
  }
  function choose(next) {
    next = Math.max(
      0,
      Math.min(
        maximum,
        Math.round(next / (options.step || 0.5)) * (options.step || 0.5),
      ),
    );
    if (next === value) return;
    value = next;
    paint();
    options.onChange(value || null);
  }
  function at(clientX) {
    const rect = slider.getBoundingClientRect();
    if (!rect.width) return value;
    return Math.max(
      0.5,
      Math.min(
        maximum,
        Math.ceil(((clientX - rect.left) / rect.width) * maximum * 2) / 2,
      ),
    );
  }
  listen(slider, "pointerdown", (event) => {
    if (event.button !== 0) return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      original: value,
      dragging: false,
    };
    slider.focus({ preventScroll: true });
    slider.setPointerCapture(event.pointerId);
  });
  listen(slider, "pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const x = Math.abs(event.clientX - pointer.x),
      y = Math.abs(event.clientY - pointer.y);
    if (!pointer.dragging && x > 5 && x > y) pointer.dragging = true;
    if (pointer.dragging) choose(at(event.clientX));
  });
  listen(slider, "pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    choose(at(event.clientX));
    pointer = null;
    if (slider.hasPointerCapture(event.pointerId))
      slider.releasePointerCapture(event.pointerId);
  });
  listen(slider, "pointercancel", () => {
    if (pointer) choose(pointer.original);
    pointer = null;
  });
  listen(slider, "keydown", (event) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    choose(
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? maximum
          : value +
            (["ArrowLeft", "ArrowDown"].includes(event.key)
              ? -(options.step || 0.5)
              : options.step || 0.5),
    );
  });
  listen(clear, "click", () => choose(0));
  paint();
  return {
    element,
    update(next, nextMaximum = maximum) {
      maximum = nextMaximum;
      value = Math.max(0, Math.min(maximum, Number(next) || 0));
      paint();
    },
  };
}
