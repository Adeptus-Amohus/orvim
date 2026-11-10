import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  Inbox,
  Layers,
  MoreHorizontal,
  Sparkles,
  Sun,
} from "lucide-react";
import type { Page } from "../domain/models";

export const navigation = [
  { id: "now", label: "Now", icon: Sun },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "projects", label: "Projects", icon: Layers },
  { id: "life", label: "Life", icon: Compass },
  { id: "wins", label: "Wins", icon: Sparkles },
  { id: "review", label: "Review", icon: BookOpen },
  { id: "someday", label: "Someday", icon: MoreHorizontal },
] as const;
const secondary = new Set<Page>(["review", "someday"]);
export function Navigation({
  page,
  onNavigate,
  inboxCount,
  compact = false,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  inboxCount: number;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    root.current?.querySelector<HTMLButtonElement>(".more-nav button")?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  function link(item: (typeof navigation)[number]) {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        className={`nav-link${page === item.id ? " active" : ""}${item.id === "review" ? " nav-secondary-start" : ""}`}
        aria-current={page === item.id ? "page" : undefined}
        onClick={() => {
          setExpanded(false);
          if (compact && item.id === page) toggle.current?.focus();
          onNavigate(item.id);
        }}
      >
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        <span>{item.label}</span>
        {item.id === "inbox" && inboxCount > 0 && (
          <span
            className="nav-count"
            aria-label={`${inboxCount} unprocessed captures`}
          >
            {inboxCount > 99 ? "99+" : inboxCount}
          </span>
        )}
      </button>
    );
  }
  return (
    <nav
      ref={root}
      className={compact ? "bottom-nav" : undefined}
      aria-label={compact ? "Compact navigation" : "Main navigation"}
    >
      {navigation
        .filter((item) => !compact || !secondary.has(item.id))
        .map(link)}
      {compact && (
        <>
          <button
            ref={toggle}
            className={
              secondary.has(page)
                ? "nav-link more-toggle active"
                : "nav-link more-toggle"
            }
            aria-label="More navigation"
            aria-expanded={expanded}
            aria-controls="more-navigation"
            onClick={() => setExpanded((value) => !value)}
          >
            <MoreHorizontal size={20} strokeWidth={1.7} />
            <span>More</span>
          </button>
          {expanded && (
            <div className="more-nav" id="more-navigation">
              {navigation.filter((item) => secondary.has(item.id)).map(link)}
            </div>
          )}
        </>
      )}
    </nav>
  );
}
