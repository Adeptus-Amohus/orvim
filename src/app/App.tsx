import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Leaf, X } from "lucide-react";
import { Navigation, navigation } from "../components/Navigation";
import type { Page, Project, ProjectStatus, Task } from "../domain/models";
import { useWorkspace } from "../application/useWorkspace";
import { useToday } from "../application/useToday";
import { ErrorNotice } from "../components/ui";
import { InboxPage } from "../features/inbox/InboxPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { ProjectForm } from "../features/projects/ProjectForm";
import { WinsPage } from "../features/wins/WinsPage";
import { WinForm } from "../features/wins/WinForm";
import { NowPage } from "../features/now/NowPage";
import { TaskForm } from "../features/now/TaskForm";
import { ActionsDialog } from "../features/now/ActionsDialog";
import { LifePage } from "../features/life/LifePage";
import { ReviewPage } from "../features/review/ReviewPage";
import type { RegisterGuard } from "../features/review/ReviewEditor";
import "./App.css";

type Modal =
  | { kind: "project"; project: Project | null; status: ProjectStatus }
  | { kind: "task"; task: Task | null; projectId: string | null; title: string }
  | { kind: "win" }
  | { kind: "actions" }
  | null;

export default function App() {
  const workspace = useWorkspace();
  const { data, error, busy, mutate, reload } = workspace;
  const today = useToday();
  const [page, setPage] = useState<Page>("now");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const guard = useRef<(() => Promise<boolean>) | null>(null);
  const navigating = useRef(false);
  const notify = useCallback((message: string) => setToast(message), []);
  const registerGuard: RegisterGuard = useCallback((value) => {
    guard.current = value;
  }, []);
  useEffect(() => {
    // Inbox keeps its capture focus. Other navigation announces the new heading.
    if (page !== "inbox") {
      document
        .querySelector<HTMLElement>("main h1")
        ?.focus({ preventScroll: true });
    }
  }, [page]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (guard.current && !(await guard.current())) event.preventDefault();
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch(() =>
        setLifecycleError(
          "Could not enable save-on-close. Save your review before closing the window.",
        ),
      );
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  const navigate = useCallback(
    (next: Page) => {
      if (next === page || navigating.current) return;
      navigating.current = true;
      void (async () => {
        try {
          if (!guard.current || (await guard.current())) {
            setPage(next);
            window.scrollTo({ top: 0 });
          }
        } finally {
          navigating.current = false;
        }
      })();
    },
    [page],
  );
  useEffect(() => {
    const back = (event: Event) => {
      const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
      if (dialog) {
        event.preventDefault();
        dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
      } else {
        const more = document.querySelector<HTMLButtonElement>(
          '.more-toggle[aria-expanded="true"]',
        );
        if (more) {
          event.preventDefault();
          more.click();
        } else if (page !== "now") {
          event.preventDefault();
          navigate("now");
        }
      }
    };
    window.addEventListener("life-os:back", back);
    return () => window.removeEventListener("life-os:back", back);
  }, [navigate, page]);
  const createProject = (status: ProjectStatus) =>
    setModal({ kind: "project", project: null, status });
  const editProject = (project: Project) =>
    setModal({ kind: "project", project, status: project.status });
  const newTask = () =>
    setModal({ kind: "task", task: null, projectId: null, title: "" });
  const editTask = (task: Task) =>
    setModal({
      kind: "task",
      task,
      projectId: task.project_id,
      title: task.title,
    });
  const plan = (project: Project) =>
    setModal({
      kind: "task",
      task: null,
      projectId: project.id,
      title: (project.next_action ?? "").slice(0, 200),
    });
  const newWin = () => setModal({ kind: "win" });
  const close = () => setModal(null);
  const inboxCount =
    data?.inbox_items.filter((item) => !item.processed_at).length ?? 0;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={21} strokeWidth={1.6} />
          </span>
          <span>
            Orvim
            <span className="brand-subtitle">Space for what matters.</span>
          </span>
        </div>
        <Navigation page={page} onNavigate={navigate} inboxCount={inboxCount} />
        <div className="sidebar-note">
          <span className="color-dot" />
          Your space. On this device.
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <span className="mobile-brand">
            <Leaf size={18} />
            Orvim
          </span>
          <span className="desktop-breadcrumb">
            Your workspace<span>/</span>
            {navigation.find((item) => item.id === page)?.label}
          </span>
          <span className="workspace-status" role="status">
            <span className="color-dot" />
            {busy ? "Saving…" : "On this device"}
          </span>
        </header>
        <main id="main-content" className="page-content">
          <ErrorNotice message={lifecycleError} />
          {error && (
            <div className="card storage-error">
              <h2>Couldn't open your local workspace</h2>
              <ErrorNotice message={error} />
              <p>Your existing data has not been replaced.</p>
              <button
                className="button primary"
                onClick={() => {
                  void reload();
                }}
              >
                Try again
              </button>
            </div>
          )}
          {!data && !error && (
            <div className="loading-state" role="status">
              <Leaf size={28} />
              <p>Opening your workspace…</p>
            </div>
          )}
          {data && (
            <div className="page-enter" key={page}>
              {page === "now" && (
                <NowPage
                  data={data}
                  today={today}
                  mutate={mutate}
                  navigate={navigate}
                  onTask={newTask}
                  onEditTask={editTask}
                  onActions={() => setModal({ kind: "actions" })}
                  onWin={newWin}
                  onProject={editProject}
                  onPlan={plan}
                  notify={notify}
                />
              )}
              {page === "inbox" && (
                <InboxPage data={data} mutate={mutate} notify={notify} />
              )}
              {(page === "projects" || page === "someday") && (
                <ProjectsPage
                  key={page}
                  data={data}
                  mutate={mutate}
                  onEdit={editProject}
                  onCreate={createProject}
                  onPlan={plan}
                  notify={notify}
                  someday={page === "someday"}
                />
              )}
              {page === "wins" && (
                <WinsPage
                  data={data}
                  today={today}
                  mutate={mutate}
                  onAdd={newWin}
                  notify={notify}
                />
              )}
              {page === "life" && <LifePage data={data} today={today} />}
              {page === "review" && (
                <ReviewPage
                  data={data}
                  today={today}
                  mutate={mutate}
                  registerGuard={registerGuard}
                  notify={notify}
                />
              )}
            </div>
          )}
        </main>
      </div>
      <Navigation
        compact
        page={page}
        onNavigate={navigate}
        inboxCount={inboxCount}
      />
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {data && modal?.kind === "project" && (
        <ProjectForm
          project={modal.project}
          initialStatus={modal.status}
          areas={data.areas}
          mutate={mutate}
          onClose={close}
          notify={notify}
        />
      )}
      {data && modal?.kind === "task" && (
        <TaskForm
          task={modal.task}
          projectId={modal.projectId}
          initialTitle={modal.title}
          data={data}
          today={today}
          mutate={mutate}
          onClose={close}
          notify={notify}
        />
      )}
      {data && modal?.kind === "win" && (
        <WinForm
          data={data}
          today={today}
          mutate={mutate}
          onClose={close}
          notify={notify}
        />
      )}
      {data && modal?.kind === "actions" && (
        <ActionsDialog
          data={data}
          mutate={mutate}
          onEdit={editTask}
          onClose={close}
        />
      )}
    </div>
  );
}
