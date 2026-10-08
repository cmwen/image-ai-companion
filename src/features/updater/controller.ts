export const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
export type UpdateEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };
export interface UpdateResource {
  version: string;
  download(
    handler: (event: UpdateEvent) => void,
    options: { timeout: number },
  ): Promise<void>;
  install(): Promise<void>;
  close(): Promise<void>;
}
export interface UpdaterBackend {
  check(options: { timeout: number }): Promise<UpdateResource | null>;
  restart(): Promise<void>;
}
export interface UpdateState {
  phase:
    | "idle"
    | "checking"
    | "downloading"
    | "installing"
    | "ready"
    | "error"
    | "restarting";
  message: string;
  version?: string;
  progress?: number;
}
export function createUpdater(backend: UpdaterBackend) {
  let state: UpdateState = { phase: "idle", message: "" },
    active = false,
    busy = false,
    installed = false,
    timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<(state: UpdateState) => void>();
  const show = (next: UpdateState) => {
    state = next;
    if (active) for (const listener of listeners) listener(state);
  };
  async function check(manual = false) {
    if (!active || busy || installed) return;
    busy = true;
    let update: UpdateResource | null = null;
    show({ phase: "checking", message: manual ? "Checking for updates…" : "" });
    try {
      update = await backend.check({ timeout: 15000 });
      if (!active) return;
      if (!update) {
        show({ phase: "idle", message: manual ? "You’re up to date." : "" });
        return;
      }
      const version = update.version;
      let downloaded = 0,
        total = 0;
      show({
        phase: "downloading",
        version,
        message: `Downloading v${version}…`,
      });
      await update.download(
        (event) => {
          if (!active) return;
          if (event.event === "Started") total = event.data.contentLength ?? 0;
          if (event.event === "Progress") {
            downloaded += event.data.chunkLength;
            const progress =
              total > 0
                ? Math.min(100, Math.round((downloaded / total) * 100))
                : undefined;
            show({
              phase: "downloading",
              version,
              progress,
              message: `Downloading v${version}${progress !== undefined ? ` · ${progress}%` : ""}…`,
            });
          }
        },
        { timeout: 180000 },
      );
      if (!active) return;
      show({
        phase: "installing",
        version,
        message: `Installing v${version}…`,
      });
      await update.install();
      installed = true;
      show({
        phase: "ready",
        version,
        message: `v${version} installed. Restart when you’re ready.`,
      });
    } catch {
      if (active)
        show({
          phase: "error",
          message:
            manual || update
              ? "Update unavailable. Check your connection and try again."
              : "",
        });
    } finally {
      await update?.close().catch(() => {});
      busy = false;
    }
  }
  async function restart() {
    if (!active || !installed || busy) return;
    busy = true;
    const version = state.version;
    show({ phase: "restarting", version, message: "Restarting…" });
    try {
      await backend.restart();
    } catch {
      show({
        phase: "ready",
        version,
        message:
          "Could not restart. Close and reopen the app to finish updating.",
      });
    } finally {
      busy = false;
    }
  }
  return {
    getState: () => state,
    subscribe(listener: (state: UpdateState) => void) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      active = true;
      if (timer === undefined) {
        timer = setInterval(() => void check(), UPDATE_INTERVAL);
        void check();
      }
    },
    stop() {
      active = false;
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    },
    check: () => check(true),
    restart,
  };
}
