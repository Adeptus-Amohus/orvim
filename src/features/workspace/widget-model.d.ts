import type { WorkspaceSnapshot } from "./runtime";
export function widgetSnapshot(
  snapshot: WorkspaceSnapshot,
  now?: number,
  locale?: string,
): {
  version: number;
  updatedAt: number;
  language: string;
  appearance: string;
  dayStartMinutes: number;
  ai: { provider: string; model: string };
  appliedOperations: string[];
  days: {
    date: string;
    items: {
      kind: string;
      id: number;
      title: string;
      start: string;
      end: string;
      duration: number;
      done: boolean;
    }[];
    total: number;
    calories: number;
    foodTarget: number;
  }[];
};
