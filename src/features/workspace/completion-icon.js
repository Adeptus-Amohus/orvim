// Completion buttons use one vector mark, including quick workout results.
export function setCompletionIcon(button, completed) {
  button.setAttribute("aria-pressed", String(Boolean(completed)));
  if (!completed) {
    if (button.childNodes.length) button.replaceChildren();
    return;
  }
  if (
    button.childNodes.length === 1 &&
    button.firstElementChild?.matches("svg[data-completion-icon]")
  )
    return;
  const ns = "http://www.w3.org/2000/svg";
  const icon = button.ownerDocument.createElementNS(ns, "svg");
  icon.setAttribute("data-completion-icon", "");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2.25");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const mark = button.ownerDocument.createElementNS(ns, "path");
  mark.setAttribute("d", "m6.5 12 3.5 3.5 7.5-7.5");
  icon.append(mark);
  button.replaceChildren(icon);
}
