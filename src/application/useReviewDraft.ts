import { useCallback, useEffect, useRef, useState } from "react";
import type { Review, ReviewEntry, ReviewInput } from "../domain/models";
import { reviewSections } from "../domain/reviews";
import { repository } from "../data/repository";
import { errorMessage } from "./useWorkspace";
import type { Workspace } from "./useWorkspace";

interface Draft {
  step: number;
  entries: Record<string, string>;
  focuses: string[];
}
export function useReviewDraft(
  review: Review,
  entries: ReviewEntry[],
  mutate: Workspace["mutate"],
) {
  const [draft, setDraft] = useState<Draft>(() => ({
    step: review.current_step,
    entries: Object.fromEntries(
      reviewSections.map((s) => [
        s.id,
        entries.find((e) => e.section === s.id)?.content ?? "",
      ]),
    ),
    focuses: [1, 2, 3].map(
      (i) => entries.find((e) => e.section === `focus_${i}`)?.content ?? "",
    ),
  }));
  const latest = useRef(draft);
  const [savedToken, setSavedToken] = useState(JSON.stringify(draft));
  const saved = useRef(savedToken);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const completed = useRef(review.status === "completed");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const change = useCallback((update: (current: Draft) => Draft) => {
    const next = update(latest.current);
    latest.current = next;
    setDraft(next);
  }, []);
  const persist = useCallback(
    (complete = false): Promise<boolean> => {
      if (completed.current) return Promise.resolve(true);
      const snapshot = latest.current;
      const token = JSON.stringify(snapshot);
      const input: ReviewInput = {
        id: review.id,
        current_step: snapshot.step,
        entries: reviewSections.map((s) => ({
          section: s.id,
          content: snapshot.entries[s.id] ?? "",
        })),
        focuses: snapshot.focuses.map((f) => f.trim()).filter(Boolean),
        complete,
      };
      queue.current = queue.current.then(async () => {
        if (completed.current || (!complete && saved.current === token))
          return true;
        if (mounted.current) {
          setSaving(true);
          setError(null);
        }
        try {
          await mutate(() => repository.saveReview(input));
          saved.current = token;
          completed.current = complete;
          if (mounted.current) setSavedToken(token);
          return true;
        } catch (reason) {
          if (mounted.current) setError(errorMessage(reason));
          return false;
        } finally {
          if (mounted.current) setSaving(false);
        }
      });
      return queue.current;
    },
    [mutate, review.id],
  );
  useEffect(() => {
    // Android can suspend the WebView before the debounce timer fires.
    // Explicit Save still provides the durable acknowledgement before quitting.
    const pause = () => {
      void persist();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    window.addEventListener("life-os:pause", pause);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("life-os:pause", pause);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [persist]);
  useEffect(() => {
    if (
      review.status === "completed" ||
      JSON.stringify(draft) === saved.current
    )
      return;
    const timer = window.setTimeout(() => {
      void persist();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, persist, review.status]);
  return {
    draft,
    change,
    persist,
    saving,
    error,
    dirty: JSON.stringify(draft) !== savedToken,
  };
}
