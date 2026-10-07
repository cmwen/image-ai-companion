import type { DestinationId } from "../../types/domain";
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface EmbeddedBridge {
  embed(id: DestinationId, bounds: Bounds): Promise<void>;
  resize(id: DestinationId, bounds: Bounds): Promise<void>;
  hide(): Promise<void>;
  reload(id: DestinationId): Promise<void>;
  close(id: DestinationId): Promise<void>;
  focus(id: DestinationId): Promise<void>;
}
export function visibleBounds(
  rect: Bounds,
  viewport: { width: number; height: number },
): Bounds | null {
  const x = Math.max(0, rect.x),
    y = Math.max(0, rect.y),
    right = Math.min(viewport.width, rect.x + rect.width),
    bottom = Math.min(viewport.height, rect.y + rect.height);
  const bounds = { x, y, width: right - x, height: bottom - y };
  if (
    !Object.values(bounds).every(Number.isFinite) ||
    bounds.width < 240 ||
    bounds.height < 160
  )
    return null;
  return bounds;
}
// Serialize changes: a late native show must never win over a newer hide/navigation.
export function createEmbeddedController(
  bridge: EmbeddedBridge,
  onError: (error: unknown) => void,
) {
  let pending = Promise.resolve(),
    revision = 0,
    current: DestinationId | null = null,
    last = "";
  const sync = (id: DestinationId, active: boolean, bounds: Bounds | null) => {
    const requested = ++revision;
    pending = pending
      .then(async () => {
        if (requested !== revision) return;
        if (!active || !bounds) {
          await bridge.hide();
          current = null;
          last = "";
          return;
        }
        const key = JSON.stringify(bounds);
        if (current !== id) {
          await bridge.embed(id, bounds);
          current = id;
          last = key;
        } else if (last !== key) {
          await bridge.resize(id, bounds);
          last = key;
        }
      })
      .catch((error) => {
        current = null;
        last = "";
        onError(error);
      });
    return pending;
  };
  return {
    sync,
    async reload(id: DestinationId) {
      pending = pending.then(() => bridge.reload(id)).catch(onError);
      return pending;
    },
    async close(id: DestinationId) {
      revision++;
      pending = pending
        .then(async () => {
          await bridge.close(id);
          current = null;
          last = "";
        })
        .catch(onError);
      return pending;
    },
    dispose() {
      return sync("chatgpt", false, null);
    },
  };
}
export async function nativeEmbeddedBridge(): Promise<EmbeddedBridge> {
  const { invoke } = await import("@tauri-apps/api/core");
  return {
    embed: (id, bounds) => invoke("embed_destination", { id, bounds }),
    resize: (id, bounds) => invoke("update_destination_bounds", { id, bounds }),
    hide: () => invoke("hide_destination"),
    reload: (id) => invoke("reload_destination", { id }),
    close: (id) => invoke("close_destination", { id }),
    focus: (id) => invoke("focus_destination", { id }),
  };
}
