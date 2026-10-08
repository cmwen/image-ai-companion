import { afterEach, describe, it, expect, vi } from "vitest";
import capability from "../src-tauri/capabilities/main.json";
import {
  createUpdater,
  UPDATE_INTERVAL,
  type UpdateResource,
  type UpdaterBackend,
} from "../src/features/updater/controller";
function setup() {
  const resource: UpdateResource = {
    version: "0.1.5",
    download: vi.fn(async (handler) => {
      handler({ event: "Started", data: { contentLength: 100 } });
      handler({ event: "Progress", data: { chunkLength: 40 } });
      handler({ event: "Progress", data: { chunkLength: 80 } });
      handler({ event: "Finished" });
    }),
    install: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const backend: UpdaterBackend = {
    check: vi.fn(async () => resource),
    restart: vi.fn(async () => {}),
  };
  return { resource, backend, controller: createUpdater(backend) };
}
afterEach(() => vi.useRealTimers());
describe("signed desktop updater lifecycle", () => {
  it("grants updater/restart only to the local companion, never destination children", () => {
    expect(capability.webviews).toEqual(["main"]);
    expect(capability).not.toHaveProperty("windows");
    expect(capability).not.toHaveProperty("remote");
    expect(capability.permissions).toContain("updater:default");
    expect(capability.permissions).toContain("process:allow-restart");
    expect(capability.permissions).not.toContain("process:allow-exit");
  });
  it("launch downloads/installs, clamps progress, closes resource and awaits explicit restart", async () => {
    const { resource, backend, controller: c } = setup();
    const states: any[] = [];
    c.subscribe((s) => states.push(s));
    c.start();
    await vi.waitFor(() => expect(c.getState().phase).toBe("ready"));
    expect(resource.install).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(resource.close).toHaveBeenCalledOnce());
    expect(states.find((s) => s.progress === 100)).toBeTruthy();
    expect(backend.restart).not.toHaveBeenCalled();
    await c.check();
    expect(backend.check).toHaveBeenCalledOnce();
    await c.restart();
    expect(backend.restart).toHaveBeenCalledOnce();
    c.stop();
  });
  it("offline automatic checks stay quiet while manual failures and retry remain actionable", async () => {
    const { backend, controller: c } = setup();
    backend.check = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(null);
    c.start();
    await vi.waitFor(() => expect(c.getState().phase).toBe("error"));
    await Promise.resolve();
    expect(c.getState().message).toBe("");
    await c.check();
    expect(c.getState().message).toContain("try again");
    await c.check();
    expect(c.getState().message).toBe("You’re up to date.");
    c.stop();
  });
  it("StrictMode remount/in-flight check never duplicates and unmounted results close without installing", async () => {
    const { backend, resource, controller: c } = setup();
    let resolve!: (value: UpdateResource) => void;
    backend.check = vi.fn(
      () =>
        new Promise<UpdateResource>((r) => {
          resolve = r;
        }),
    );
    c.start();
    c.stop();
    c.start();
    await c.check();
    expect(backend.check).toHaveBeenCalledOnce();
    c.stop();
    resolve(resource);
    await vi.waitFor(() => expect(resource.close).toHaveBeenCalledOnce());
    expect(resource.download).not.toHaveBeenCalled();
    expect(resource.install).not.toHaveBeenCalled();
  });
  it("unmount during download skips install and cleans resources", async () => {
    const { resource, controller: c } = setup();
    let finish!: () => void;
    resource.download = vi.fn(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    c.start();
    await vi.waitFor(() => expect(resource.download).toHaveBeenCalledOnce());
    c.stop();
    finish();
    await vi.waitFor(() => expect(resource.close).toHaveBeenCalledOnce());
    expect(resource.install).not.toHaveBeenCalled();
  });
  it("checks every six hours and cancels timer on cleanup", async () => {
    vi.useFakeTimers();
    const { backend, controller: c } = setup();
    backend.check = vi.fn(async () => null);
    c.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL);
    expect(backend.check).toHaveBeenCalledTimes(2);
    c.stop();
    await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL);
    expect(backend.check).toHaveBeenCalledTimes(2);
  });
  it("failed install closes resource and permits retry; restart failure retains installed status", async () => {
    const { resource, backend, controller: c } = setup();
    resource.install = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk unavailable"))
      .mockResolvedValueOnce(undefined);
    c.start();
    await vi.waitFor(() => expect(c.getState().phase).toBe("error"));
    await vi.waitFor(() => expect(resource.close).toHaveBeenCalledOnce());
    await c.check();
    expect(c.getState().phase).toBe("ready");
    backend.restart = vi.fn().mockRejectedValue(new Error("failed"));
    await c.restart();
    expect(c.getState().phase).toBe("ready");
    expect(c.getState().message).toContain("Close and reopen");
    c.stop();
  });
});
