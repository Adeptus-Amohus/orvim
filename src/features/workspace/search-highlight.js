// Build search emphasis as DOM nodes so saved text never becomes HTML.
export function highlightText(host, text, query) {
  const value = String(text || ""),
    needle = String(query || "")
      .trim()
      .toLocaleLowerCase();
  if (!needle) {
    host.append(document.createTextNode(value));
    return;
  }
  const normalized = value.toLocaleLowerCase();
  let start = 0,
    index;
  while ((index = normalized.indexOf(needle, start)) !== -1) {
    host.append(document.createTextNode(value.slice(start, index)));
    const mark = document.createElement("mark");
    mark.textContent = value.slice(index, index + needle.length);
    host.append(mark);
    start = index + needle.length;
  }
  host.append(document.createTextNode(value.slice(start)));
}
export function highlightTree(host, query) {
  if (!query?.trim()) return;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT),
    nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    highlightText(fragment, node.textContent, query);
    node.replaceWith(fragment);
  }
}
