import { describe, it, expect, vi } from "vitest";
import {
  createEmbeddedController,
  visibleBounds,
  type EmbeddedBridge,
} from "../src/features/destinations/embedded";
const bounds = { x: 620, y: 160, width: 500, height: 600 };
function bridge(): EmbeddedBridge {
  return {
    embed: vi.fn(async () => {}),
    resize: vi.fn(async () => {}),
    hide: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    focus: vi.fn(async () => {}),
  };
}
describe("native workspace lifecycle", () => {
  it("clips CSS logical bounds to viewport and rejects empty/small/nonfinite regions", () => {
    expect(
      visibleBounds(
        { x: -20, y: 100, width: 500, height: 600 },
        { width: 400, height: 500 },
      ),
    ).toEqual({ x: 0, y: 100, width: 400, height: 400 });
    expect(
      visibleBounds(
        { x: 0, y: 0, width: 100, height: 400 },
        { width: 400, height: 500 },
      ),
    ).toBeNull();
    expect(
      visibleBounds({ ...bounds, x: Infinity }, { width: 1400, height: 1000 }),
    ).toBeNull();
  });
  it("reuses active session on resize, hides on navigation, and reactivates same session through native embed", async () => {
    const b = bridge(),
      c = createEmbeddedController(b, vi.fn());
    await c.sync("chatgpt", true, bounds);
    await c.sync("chatgpt", true, bounds);
    expect(b.embed).toHaveBeenCalledTimes(1);
    await c.sync("chatgpt", true, { ...bounds, width: 600 });
    expect(b.resize).toHaveBeenCalledWith("chatgpt", { ...bounds, width: 600 });
    await c.sync("chatgpt", false, bounds);
    expect(b.hide).toHaveBeenCalledOnce();
    await c.sync("chatgpt", true, bounds);
    expect(b.embed).toHaveBeenCalledTimes(2);
    expect(b.close).not.toHaveBeenCalled();
    await c.sync("flow", true, bounds);
    expect(b.embed).toHaveBeenLastCalledWith("flow", bounds);
    await c.dispose();
    expect(b.hide).toHaveBeenCalledTimes(2);
  });
  it("late show cannot win over navigation or modal hide", async () => {
    let finish!: () => void;
    const b = bridge();
    b.embed = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const c = createEmbeddedController(b, vi.fn());
    const show = c.sync("chatgpt", true, bounds);
    await Promise.resolve();
    const hide = c.sync("chatgpt", false, bounds);
    finish();
    await Promise.all([show, hide]);
    expect(b.hide).toHaveBeenCalledOnce();
  });
  it("reports errors and retries after failure without leaving the queue rejected", async () => {
    const b = bridge(),
      errors = vi.fn();
    b.embed = vi
      .fn()
      .mockRejectedValueOnce(new Error("native unavailable"))
      .mockResolvedValueOnce(undefined);
    const c = createEmbeddedController(b, errors);
    await c.sync("flow", true, bounds);
    expect(errors).toHaveBeenCalledOnce();
    await c.sync("flow", true, bounds);
    expect(b.embed).toHaveBeenCalledTimes(2);
    await c.reload("flow");
    expect(b.reload).toHaveBeenCalledWith("flow");
    await c.close("flow");
    expect(b.close).toHaveBeenCalledWith("flow");
  });
});
