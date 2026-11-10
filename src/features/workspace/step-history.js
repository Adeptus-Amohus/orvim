import { dateFormat } from "./formatters.js";
// Touch uses the browser's scrolling and inertia; mouse drag follows the cursor.
export function installStepHistory(ctx, host, onSelect) {
  const { make, listen } = ctx;
  const viewport = make("div", "training-step-week"),
    period = make("small", "training-step-period aux-note");
  viewport.id = "steps-history";
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "group");
  viewport.setAttribute(
    "aria-label",
    ctx.translate("Шаги по дням", "Steps by day"),
  );
  period.dataset.userContent = "";
  host.append(viewport, period);
  const shift = (day, amount) => {
    const date = new Date(day + "T12:00:00");
    date.setDate(date.getDate() + amount);
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  };
  let from = "",
    until = "",
    selected = "",
    rows = [],
    paintedRange = "",
    drag = null,
    suppressClickUntil = 0,
    keepSelectionPosition = false,
    alignmentNeeded = true,
    previousWidth = 0,
    frame = 0,
    edgeTimer = 0,
    wheelTimer = 0,
    wheelTarget = null,
    disposed = false,
    dataKey = "";
  const smooth = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
  const buttons = () => [...viewport.children];
  function visible() {
    const left = viewport.scrollLeft,
      right = left + viewport.clientWidth;
    return buttons().filter(
      (node) =>
        node.offsetLeft + node.offsetWidth > left + 1 &&
        node.offsetLeft < right - 1,
    );
  }
  function paintPeriod() {
    if (!viewport.clientWidth) return;
    const nodes = visible();
    if (!nodes.length) return;
    const format = dateFormat(ctx.displayLocale(), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    period.textContent =
      format.format(new Date(nodes[0].dataset.stepDay + "T12:00:00")) +
      " — " +
      format.format(new Date(nodes.at(-1).dataset.stepDay + "T12:00:00"));
  }
  function alignSelection() {
    const node = buttons().find(
      (button) => button.dataset.stepDay === selected,
    );
    if (!node || !viewport.clientWidth) {
      alignmentNeeded = true;
      return;
    }
    alignmentNeeded = false;
    viewport.scrollTo({
      left: Math.max(
        0,
        node.offsetLeft + node.offsetWidth - viewport.clientWidth,
      ),
      behavior: "instant",
    });
    paintPeriod();
  }
  function paint({ align = false } = {}) {
    const focusedDay = viewport.contains(document.activeElement)
      ? document.activeElement?.dataset.stepDay
      : null;
    const oldAnchor = visible()[0],
      anchorDay = oldAnchor?.dataset.stepDay,
      anchorOffset = oldAnchor ? viewport.scrollLeft - oldAnchor.offsetLeft : 0;
    const range = from + until;
    if (paintedRange !== range) {
      paintedRange = range;
      viewport.replaceChildren();
      for (
        let day = from, index = 0;
        day <= until && index < 366;
        day = shift(day, 1), index++
      ) {
        const button = make("button", "training-step-day"),
          track = make("span", "training-step-track"),
          bar = make("span");
        button.type = "button";
        button.tabIndex = -1;
        button.dataset.stepDay = day;
        track.append(bar);
        button.append(track, make("small", "", day.slice(8)));
        viewport.append(button);
      }
    }
    const values = new Map();
    for (const row of rows)
      if (!values.has(row.date)) values.set(row.date, row.count);
    const peak = Math.max(
      1,
      ...buttons().map((node) => values.get(node.dataset.stepDay) || 0),
    );
    for (const button of buttons()) {
      const day = button.dataset.stepDay,
        value = values.get(day);
      button.querySelector(".training-step-track > span").style.height = !value
        ? "0%"
        : Math.max(2, (value / peak) * 100) + "%";
      button.setAttribute("aria-pressed", String(day === selected));
      button.setAttribute(
        "aria-label",
        ctx.shortDate(day) +
          ": " +
          (value === undefined
            ? ctx.translate("Нет записи", "No entry")
            : value.toLocaleString(ctx.displayLocale())),
      );
    }
    if (align || alignmentNeeded) alignSelection();
    else if (anchorDay) {
      const anchor = buttons().find(
        (node) => node.dataset.stepDay === anchorDay,
      );
      if (anchor)
        viewport.scrollTo({
          left: anchor.offsetLeft + anchorOffset,
          behavior: "instant",
        });
      paintPeriod();
    }
    if (focusedDay && !viewport.contains(document.activeElement))
      buttons()
        .find((node) => node.dataset.stepDay === focusedDay)
        ?.focus({ preventScroll: true });
  }
  function extend() {
    if (
      disposed ||
      drag ||
      !viewport.clientWidth ||
      viewport.children.length >= 365
    )
      return;
    const stride =
      (viewport.children[1]?.offsetLeft || 0) -
      (viewport.children[0]?.offsetLeft || 0);
    if (stride <= 0) return;
    const count = Math.min(35, 365 - viewport.children.length);
    if (viewport.scrollLeft < stride * 2) from = shift(from, -count);
    else if (
      viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft <
      stride * 2
    )
      until = shift(until, count);
    else return;
    paint();
  }
  listen(
    viewport,
    "scroll",
    () => {
      if (!frame)
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          if (!disposed) paintPeriod();
        });
      window.clearTimeout(edgeTimer);
      edgeTimer = window.setTimeout(extend, 180);
    },
    { passive: true },
  );
  listen(viewport, "pointerdown", (event) => {
    wheelTarget = null;
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    viewport.scrollTo({ left: viewport.scrollLeft, behavior: "instant" });
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      moved: false,
    };
  });
  listen(viewport, "pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const x = event.clientX - drag.x,
      y = event.clientY - drag.y;
    if (!drag.moved && Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
      drag = null;
      return;
    }
    if (!drag.moved && Math.abs(x) > 6 && Math.abs(x) > Math.abs(y) * 1.3) {
      drag.moved = true;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    event.preventDefault();
    viewport.scrollLeft = drag.left - x;
  });
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) suppressClickUntil = Date.now() + 450;
    drag = null;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture?.(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
    extend();
  }
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(viewport, event, finish);
  listen(
    viewport,
    "click",
    (event) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const node = event.target.closest("[data-step-day]");
      if (!node) return;
      keepSelectionPosition = true;
      onSelect(node.dataset.stepDay);
    },
    true,
  );
  listen(
    viewport,
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
              ? viewport.clientWidth
              : 1),
        next = Math.max(
          0,
          Math.min(
            viewport.scrollWidth - viewport.clientWidth,
            (wheelTarget ?? viewport.scrollLeft) + delta,
          ),
        );
      if (!delta || next === (wheelTarget ?? viewport.scrollLeft)) return;
      event.preventDefault();
      wheelTarget = next;
      viewport.scrollTo({ left: next, behavior: smooth() });
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheelTarget = null;
      }, 200);
    },
    { passive: false },
  );
  listen(viewport, "keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const nodes = buttons(),
      current = event.target.closest("[data-step-day]"),
      shown = visible();
    const index = current
      ? nodes.indexOf(current)
      : nodes.indexOf(shown[Math.floor(shown.length / 2)]);
    const next =
      nodes[
        Math.max(
          0,
          Math.min(
            nodes.length - 1,
            index + (event.key === "ArrowRight" ? 1 : -1),
          ),
        )
      ];
    if (!next) return;
    next.focus({ preventScroll: true });
    if (next.offsetLeft < viewport.scrollLeft)
      viewport.scrollTo({ left: next.offsetLeft, behavior: smooth() });
    else if (
      next.offsetLeft + next.offsetWidth >
      viewport.scrollLeft + viewport.clientWidth
    )
      viewport.scrollTo({
        left: next.offsetLeft + next.offsetWidth - viewport.clientWidth,
        behavior: smooth(),
      });
  });
  const resize = () => {
    const width = viewport.clientWidth;
    if (!width) return;
    if (alignmentNeeded) alignSelection();
    else if (previousWidth && width !== previousWidth)
      viewport.scrollLeft *= width / previousWidth;
    previousWidth = width;
    paintPeriod();
  };
  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(viewport);
  listen(window, "resize", resize);
  return {
    render(nextRows, date, forceAlign = false) {
      const nextKey = JSON.stringify([date, ctx.displayLocale(), nextRows]);
      if (nextKey === dataKey && !forceAlign) {
        if (alignmentNeeded) alignSelection();
        keepSelectionPosition = false;
        return;
      }
      dataKey = nextKey;
      const changed = selected !== date;
      rows = nextRows;
      selected = date;
      if (!from || date < from || date > until) {
        from = shift(date, -84);
        until = shift(date, 7);
      }
      paint({ align: forceAlign || (changed && !keepSelectionPosition) });
      keepSelectionPosition = false;
    },
    dispose() {
      disposed = true;
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(edgeTimer);
      window.clearTimeout(wheelTimer);
    },
  };
}
