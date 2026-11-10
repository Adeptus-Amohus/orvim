export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type TaskStatus = "open" | "completed" | "cancelled";
export type WinSource =
  | "manual"
  | "task_completion"
  | "project_completion"
  | "streak"
  | "ai_suggestion";
export interface Area {
  id: string;
  name: string;
  icon: string;
  accent: string;
  position: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
export interface Project {
  id: string;
  title: string;
  description: string;
  area_id: string | null;
  status: ProjectStatus;
  next_action: string | null;
  target_date: string | null;
  review_date: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
export type ProjectInput = Omit<
  Project,
  "id" | "created_at" | "updated_at" | "archived_at"
> & { id: string | null };
export interface InboxItem {
  id: string;
  content: string;
  created_at: string;
  processed_at: string | null;
}
export interface Task {
  id: string;
  title: string;
  notes: string | null;
  project_id: string | null;
  area_id: string | null;
  status: TaskStatus;
  scheduled_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export type TaskInput = Omit<
  Task,
  "id" | "status" | "completed_at" | "created_at" | "updated_at"
> & { id: string | null };
export interface Win {
  id: string;
  title: string;
  note: string | null;
  area_id: string | null;
  project_id: string | null;
  task_id: string | null;
  source: WinSource;
  occurred_at: string;
  created_at: string;
}
export type WinInput = Omit<Win, "id" | "source" | "created_at">;
export interface DailyCheckin {
  id: string;
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_minutes: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}
export type CheckinInput = Omit<
  DailyCheckin,
  "id" | "created_at" | "updated_at"
>;
export interface Review {
  id: string;
  type: "weekly";
  period_start: string;
  period_end: string;
  status: "in_progress" | "completed";
  current_step: number;
  created_at: string;
  completed_at: string | null;
}
export interface ReviewEntry {
  id: string;
  review_id: string;
  section: string;
  content: string;
  created_at: string;
  updated_at: string;
}
export interface ReviewInput {
  id: string;
  current_step: number;
  entries: { section: string; content: string }[];
  focuses: string[];
  complete: boolean;
}
export interface Snapshot {
  areas: Area[];
  projects: Project[];
  inbox_items: InboxItem[];
  tasks: Task[];
  wins: Win[];
  checkins: DailyCheckin[];
  reviews: Review[];
  review_entries: ReviewEntry[];
}
export type Page =
  "now" | "inbox" | "projects" | "life" | "wins" | "review" | "someday";
