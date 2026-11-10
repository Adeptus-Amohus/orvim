export interface WorkspaceSnapshot {
  data: Record<string, unknown>;
  covers: [number, string][];
}
export interface WorkspaceDocument extends WorkspaceSnapshot {
  revision: number;
}
export interface WorkspaceServices {
  persist(snapshot: WorkspaceSnapshot): void;
  flush(): Promise<void>;
  readDocument?(): Promise<WorkspaceDocument>;
  refreshIcons(root: HTMLElement): void;
  openFile(kind: "backup" | "image" | "document"): Promise<File | null>;
  saveFile(name: string, type: string, content: string): Promise<boolean>;
  saveAttachment(name: string, data: string): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  mobile?: boolean;
  backups?(
    operation: string,
    name?: string,
    password?: string,
    content?: string,
  ): Promise<any>;
  updates?(operation: string, version?: string): Promise<any>;
  validateActions?(changes: unknown[]): Promise<any>;
  localSync?: boolean;
  lan?(
    operation: string,
    args?: Record<string, unknown>,
    document?: WorkspaceDocument,
  ): Promise<any>;
  credential?(
    operation: string,
    provider: string,
    value?: string,
  ): Promise<{ configured: boolean }>;
  request?(args: Record<string, unknown>): Promise<any>;
  cancelRequest?(requestId: string): Promise<void>;
  platform?(operation: string, args: Record<string, unknown>): Promise<any>;
  googleLogin?(clientId: string, clientSecret: string): Promise<any>;
}
export function mountWorkspace(
  root: HTMLElement,
  initialDocument: WorkspaceDocument,
  services: WorkspaceServices,
): {
  snapshot(): WorkspaceSnapshot;
  importWidgetCommands(commands: any[]): string[];
  refreshLayout(): void;
  canSync(): boolean;
  applyRemote(snapshot: WorkspaceSnapshot): void;
  dispose(): void;
};
