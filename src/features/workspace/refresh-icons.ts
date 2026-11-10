import { createElement, type IconNode } from "lucide";

/** Reuse icon geometry and preserve SVGs that have already been rendered. */
export function createIconRefresher(icons: Record<string, IconNode>) {
  const definitions = new Map(
    Object.entries(icons).map(([name, definition]) => [
      name.replaceAll("-", "").toLowerCase(),
      definition,
    ]),
  );
  const templates = new Map<string, SVGElement>();
  const rendered = new WeakMap<Element, string>();
  return (root: Element | Document = document) => {
    for (const placeholder of root.querySelectorAll("[data-lucide]")) {
      const name = placeholder.getAttribute("data-lucide") || "";
      if (rendered.get(placeholder) === name) continue;
      const definition = definitions.get(
        name.replaceAll("-", "").toLowerCase(),
      );
      if (!definition) continue;
      let template = templates.get(name);
      if (!template) {
        template = createElement(definition, { width: 16, height: 16 });
        templates.set(name, template);
      }
      const svg = template.cloneNode(true) as SVGElement;
      for (const { name, value } of placeholder.attributes)
        svg.setAttribute(name, value);
      svg.classList.add("lucide", "lucide-" + name);
      if (
        !["aria-label", "aria-labelledby", "role", "title", "aria-hidden"].some(
          (attribute) => svg.hasAttribute(attribute),
        )
      )
        svg.setAttribute("aria-hidden", "true");
      placeholder.replaceWith(svg);
      rendered.set(svg, name);
    }
  };
}
