// Native touch scrolling is kept. Wheel events at an inner edge are forwarded
// explicitly: rounding and wheel latching can otherwise consume the first turn.
export function installScrollChaining(root, listen) {
  listen(
    root,
    "wheel",
    (event) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return;
      const view = root.ownerDocument.defaultView;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? view.innerHeight
            : 1);
      if (!delta) return;
      const documentScroll = root.ownerDocument.scrollingElement;
      const canMove = (node) =>
        delta < 0
          ? node.scrollTop > 2
          : node.scrollHeight - node.clientHeight - node.scrollTop > 2;
      let atEdge = false;
      let node =
        event.target instanceof view.Element
          ? event.target
          : event.target.parentElement;
      while (node && node !== documentScroll) {
        const style = view.getComputedStyle(node);
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          if (canMove(node)) {
            if (atEdge) {
              node.scrollTop += delta;
              event.preventDefault();
            }
            return;
          }
          atEdge = true;
          // Absorb subpixel leftovers so the next gesture sees the same edge.
          node.scrollTop = delta < 0 ? 0 : node.scrollHeight;
        }
        // A dialog is the outer boundary; its contents may chain within it.
        if (
          style.overscrollBehaviorY === "contain" ||
          style.overscrollBehaviorY === "none"
        )
          return;
        node = node.parentElement;
      }
      if (atEdge && documentScroll && canMove(documentScroll)) {
        documentScroll.scrollTop += delta;
        event.preventDefault();
      }
    },
    { passive: false },
  );
}
