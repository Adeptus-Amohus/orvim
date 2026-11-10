import type { WorkspaceSnapshot } from "./runtime";
export function syncDifferences(
  local: WorkspaceSnapshot,
  incoming: WorkspaceSnapshot,
  conflicts?: any[],
): any[];
