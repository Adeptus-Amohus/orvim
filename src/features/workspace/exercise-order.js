export function installExerciseOrder(ctx, host, getEntries, changed) {
  let drag = null;
  const rows = () =>
    [...host.children].filter((node) => node.dataset.exerciseOrderKey);
  const restore = (keys) => {
    for (const key of keys) {
      const row = rows().find((node) => node.dataset.exerciseOrderKey === key);
      if (row) host.append(row);
    }
  };
  const finish = (event, cancel = false) => {
    if (!drag || drag.id !== event.pointerId) return;
    const current = drag;
    drag = null;
    current.row.classList.remove("exercise-order-dragging");
    if (current.handle.hasPointerCapture(event.pointerId))
      current.handle.releasePointerCapture(event.pointerId);
    if (cancel) {
      restore(current.keys);
      return;
    }
    const entries = getEntries(),
      byKey = new Map(entries.map((entry) => [entry.exerciseKey, entry]));
    const keys = rows().map((node) => node.dataset.exerciseOrderKey);
    if (keys.length !== entries.length || keys.some((key) => !byKey.has(key)))
      return;
    if (keys.every((key, index) => key === current.keys[index])) return;
    entries.splice(0, entries.length, ...keys.map((key) => byKey.get(key)));
    changed();
  };
  ctx.listen(host, "pointerdown", (event) => {
    const handle = event.target.closest(".exercise-order-handle"),
      row = handle?.closest("[data-exercise-order-key]");
    if (!handle || row?.parentElement !== host || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    drag = {
      id: event.pointerId,
      handle,
      row,
      keys: rows().map((node) => node.dataset.exerciseOrderKey),
    };
    row.classList.add("exercise-order-dragging");
    handle.setPointerCapture?.(event.pointerId);
  });
  ctx.listen(host, "pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const before = rows().find(
      (row) =>
        row !== drag.row &&
        event.clientY <
          row.getBoundingClientRect().top +
            row.getBoundingClientRect().height / 2,
    );
    if (before) host.insertBefore(drag.row, before);
    else host.append(drag.row);
    if (!drag.handle.hasPointerCapture?.(event.pointerId))
      drag.handle.setPointerCapture?.(event.pointerId);
    const scroller = host.closest(".dialog,.training-plan-list,#task-list");
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      if (event.clientY < rect.top + 45) scroller.scrollTop -= 16;
      else if (event.clientY > rect.bottom - 45) scroller.scrollTop += 16;
    }
  });
  ctx.listen(host, "pointerup", (event) => finish(event));
  ctx.listen(host, "pointercancel", (event) => finish(event, true));
  ctx.listen(host, "keydown", (event) => {
    const handle = event.target.closest(".exercise-order-handle");
    if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const key = handle.closest("[data-exercise-order-key]").dataset
        .exerciseOrderKey,
      entries = getEntries();
    const index = entries.findIndex((entry) => entry.exerciseKey === key),
      next = index + (event.key === "ArrowUp" ? -1 : 1);
    if (index < 0 || next < 0 || next >= entries.length) return;
    [entries[index], entries[next]] = [entries[next], entries[index]];
    changed();
    rows()
      .find((row) => row.dataset.exerciseOrderKey === key)
      ?.querySelector(".exercise-order-handle")
      ?.focus({ preventScroll: true });
  });
}
