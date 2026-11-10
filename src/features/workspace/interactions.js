// Navigation stays in memory; opening a screen never changes stored records.
export function createScreenHistory() {
  let current = null;
  const previous = [];
  const key = (screen) => JSON.stringify(screen);
  return {
    visit(screen) {
      if (current && key(current) !== key(screen)) {
        previous.push(current);
        if (previous.length > 50) previous.shift();
      }
      current = { ...screen };
    },
    back() {
      const screen = previous.pop();
      if (screen) current = { ...screen };
      return screen;
    },
    reset(screen) {
      previous.length = 0;
      current = { ...screen };
    },
    replace(screen) {
      current = { ...screen };
    },
  };
}

export function isTextEntry(target) {
  return Boolean(
    target?.closest?.(
      'textarea,[contenteditable]:not([contenteditable="false"]),input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"])',
    ),
  );
}

// Ctrl+A and the Android selection menu stay inside the active text box.
export function installScopedSelection(root, listen) {
  let box = null,
    adjusting = false;
  const scope = (node) =>
    node?.closest?.(
      'textarea,input,[contenteditable="true"],.thought-feed-reading,.ai-markdown,[data-selection-box],[data-user-content]',
    );
  function selectBox(node) {
    if (node.matches("input,textarea")) {
      node.select?.();
      return;
    }
    const selection = window.getSelection(),
      range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  listen(root, "pointerdown", (event) => {
    box = scope(event.target);
  });
  listen(root, "focusin", (event) => {
    const next = scope(event.target);
    if (next && isTextEntry(next)) box = next;
  });
  listen(
    root,
    "keydown",
    (event) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        (event.code !== "KeyA" && event.key.toLowerCase() !== "a")
      )
        return;
      const active = scope(event.target) || box;
      if (!active?.isConnected || !root.contains(active)) return;
      if (
        active.matches("input") &&
        !["text", "search", "url", "tel", "password", "email"].includes(
          active.type,
        )
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      box = active;
      selectBox(active);
    },
    true,
  );
  listen(document, "selectionchange", () => {
    const selection = window.getSelection();
    if (
      adjusting ||
      !box?.isConnected ||
      !selection?.rangeCount ||
      selection.isCollapsed
    )
      return;
    const range = selection.getRangeAt(0);
    if (box.contains(range.startContainer) && box.contains(range.endContainer))
      return;
    if (!range.intersectsNode(root)) return;
    if (box.matches("input,textarea")) {
      // Native field selection can expose a collapsed shadow range. Only
      // redirect a genuine document-wide selection reaching the app chrome.
      const chrome = root.querySelector(".nav,header");
      if (range.collapsed || !chrome || !range.intersectsNode(chrome)) return;
      selection.removeAllRanges();
    }
    adjusting = true;
    selectBox(box);
    queueMicrotask(() => {
      adjusting = false;
    });
  });
}

export function isBackSwipe(start, end) {
  return Boolean(
    start &&
    end &&
    start.x <= 24 &&
    end.x - start.x >= 90 &&
    Math.abs(end.y - start.y) <= 30 &&
    end.at - start.at <= 700,
  );
}

export function revealInDialog(node) {
  if (!node?.isConnected) return;
  const dialog = node.closest(".overlay:not([hidden]) .dialog");
  if (!dialog) return;
  const box = node.getBoundingClientRect(),
    bounds = dialog.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = Math.max(bounds.top, viewport?.offsetTop || 0) + 12;
  const bottom =
    Math.min(
      bounds.bottom,
      (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight),
    ) - 64;
  if (box.top < top || box.bottom > bottom)
    node.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
}

export function installButtonHints(ctx) {
  const { root, make, listen } = ctx;
  const hint = make("div", "button-hint");
  hint.id = "workspace-button-hint";
  hint.setAttribute("role", "tooltip");
  hint.hidden = true;
  root.append(hint);
  let owner = null;
  const label = (node) => {
    if (!node) return "";
    // Visible labels already explain the action. Symbols and SVGs do not.
    const text = /[\p{L}\p{N}]/u.test(node.textContent);
    if (text && !node.matches(".drag-handle,.task-drag,.state-figure"))
      return "";
    return (
      node.dataset.tooltip ||
      node.getAttribute("aria-label") ||
      node.title ||
      ""
    );
  };
  function hide() {
    if (owner) {
      const ids = (owner.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((id) => id && id !== hint.id);
      if (ids.length) owner.setAttribute("aria-describedby", ids.join(" "));
      else owner.removeAttribute("aria-describedby");
    }
    owner = null;
    hint.hidden = true;
  }
  function show(node) {
    if (
      ctx.services?.mobile ||
      window.matchMedia("(hover: none), (pointer: coarse)").matches
    )
      return hide();
    const text = label(node);
    if (!text || node.closest("[hidden],[inert]")) return hide();
    hide();
    owner = node;
    if (!node.hasAttribute("aria-label")) node.setAttribute("aria-label", text);
    if (node.title) node.removeAttribute("title");
    hint.textContent = text;
    hint.hidden = false;
    const rect = node.getBoundingClientRect();
    const scale = Number.parseFloat(getComputedStyle(root).zoom) || 1;
    const width = hint.getBoundingClientRect().width;
    const viewport = window.visualViewport;
    const bottom =
      (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight);
    const height = hint.getBoundingClientRect().height;
    const x = Math.max(
      8,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - 8,
      ),
    );
    const y =
      rect.bottom + height + 8 < bottom
        ? rect.bottom + 8
        : rect.top - height - 8;
    hint.style.left = x / scale + "px";
    hint.style.top = Math.max(8, y) / scale + "px";
    node.setAttribute(
      "aria-describedby",
      [node.getAttribute("aria-describedby"), hint.id]
        .filter(Boolean)
        .join(" "),
    );
  }
  const button = (event) =>
    event.target.closest?.('button,[role="button"],[data-tooltip]');
  listen(root, "mouseover", (event) => {
    if (window.matchMedia("(hover: hover)").matches) show(button(event));
  });
  listen(root, "mouseout", (event) => {
    if (owner && !owner.contains(event.relatedTarget)) hide();
  });
  listen(root, "focusin", (event) => show(button(event)));
  listen(root, "focusout", hide);
  listen(root, "pointerdown", hide);
  listen(root, "keydown", (event) => {
    if (event.key === "Escape") hide();
  });
  listen(window, "resize", hide);
  listen(root, "scroll", hide, { capture: true, passive: true });
  return { hide };
}
