import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  CheckinInput,
  ProjectInput,
  ProjectStatus,
  ReviewInput,
  Snapshot,
  TaskInput,
  TaskStatus,
  WinInput,
} from "../domain/models";

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri())
    return Promise.reject(
      new Error(
        "Open Orvim in the desktop app to access your local workspace. Run npm run desktop:dev.",
      ),
    );
  return invoke<T>(command, args);
}
export const repository = {
  snapshot: () => call<Snapshot>("get_snapshot"),
  addInbox: (content: string) => call<string>("add_inbox", { content }),
  processInbox: (id: string, processed: boolean) =>
    call<void>("process_inbox", { id, processed }),
  deleteInbox: (id: string) => call<void>("delete_inbox", { id }),
  saveProject: (input: ProjectInput) => call<string>("save_project", { input }),
  setProjectStatus: (id: string, status: ProjectStatus) =>
    call<void>("set_project_status", { id, status }),
  saveTask: (input: TaskInput) => call<string>("save_task", { input }),
  setTaskStatus: (id: string, status: TaskStatus) =>
    call<void>("set_task_status", { id, status }),
  addWin: (input: WinInput) => call<string>("add_win", { input }),
  deleteWin: (id: string) => call<void>("delete_win", { id }),
  saveCheckin: (input: CheckinInput) => call<void>("save_checkin", { input }),
  startReview: (periodStart: string) =>
    call<string>("start_review", { periodStart }),
  saveReview: (input: ReviewInput) => call<void>("save_review", { input }),
};
