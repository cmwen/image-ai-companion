import { useEffect, useRef, useState } from "react";
import type { DestinationId } from "../../types/domain";
import { createDestination } from "./adapters";
import {
  createEmbeddedController,
  nativeEmbeddedBridge,
  visibleBounds,
} from "./embedded";
export default function DestinationWorkspace({
  id,
  enabled,
  active,
  onClose,
}: {
  id: DestinationId;
  enabled: boolean;
  active: boolean;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<ReturnType<typeof createEmbeddedController>>(null);
  const [message, setMessage] = useState(
    "Sign in directly here. Embedded login support is experimental.",
  );
  const state = useRef({ id, enabled, active });
  state.current = { id, enabled, active };
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let stopped = false,
      frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = state.current,
          node = host.current,
          dialog = document.querySelector(
            'dialog[open], [role="dialog"][aria-modal="true"]',
          );
        const rect = node?.getBoundingClientRect();
        const bounds = rect
          ? visibleBounds(
              { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              { width: window.innerWidth, height: window.innerHeight },
            )
          : null;
        void controller.current?.sync(
          current.id,
          current.enabled && current.active && !document.hidden && !dialog,
          bounds,
        );
      });
    };
    refresh.current = update;
    void nativeEmbeddedBridge().then((bridge) => {
      if (stopped) return;
      controller.current = createEmbeddedController(bridge, () =>
        setMessage(
          "The embedded workspace could not be opened. Use Open in browser to continue.",
        ),
      );
      update();
    });
    const observer = new ResizeObserver(update);
    if (host.current) observer.observe(host.current);
    const mutations = new MutationObserver(() => update());
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "aria-modal"],
    });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("visibilitychange", update);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("visibilitychange", update);
      void controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    refresh.current();
  }, [id, enabled, active]);
  useEffect(() => {
    let stopped = false;
    let unlisten: (() => void) | undefined;
    setMessage(
      "Sign in directly here. Embedded login support is experimental.",
    );
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const dispose = await listen<{ destinationId: string; kind: string }>(
          "destination-status",
          ({ payload }) => {
            if (stopped || payload.destinationId !== id) return;
            if (
              payload.kind === "navigation-blocked" ||
              payload.kind === "popup-blocked"
            )
              setMessage(
                "This sign-in navigation or popup is unavailable in the embedded workspace. Use Open in browser and sign in there separately.",
              );
            else if (payload.kind === "document-loaded")
              setMessage(
                "A page has loaded. Sign in directly in the pane; use your browser if sign-in is blocked.",
              );
          },
        );
        if (stopped) dispose();
        else unlisten = dispose;
      })
      .catch(() => {
        if (!stopped)
          setMessage(
            "Sign in directly here. If embedding is unavailable, use Open in browser.",
          );
      });
    return () => {
      stopped = true;
      unlisten?.();
    };
  }, [id]);
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {
      setMessage(
        "This action could not be completed. Try opening the destination in your browser.",
      );
    }
  };
  return (
    <section
      className="destination-workspace"
      aria-label="Embedded creative destination"
      hidden={!enabled || !active}
    >
      <div className="destination-workspace-toolbar">
        <div>
          <strong>{id === "chatgpt" ? "ChatGPT" : "Google Flow"}</strong>
          <span>Experimental · separate session</span>
        </div>
        <button
          onClick={() =>
            void run(() => controller.current?.reload(id) ?? Promise.resolve())
          }
        >
          Reload
        </button>
        <button onClick={() => void run(() => createDestination(id).open())}>
          Open in browser ↗
        </button>
        <button
          aria-label="Close embedded workspace"
          onClick={() => {
            onClose();
            void controller.current?.close(id);
          }}
        >
          ×
        </button>
      </div>
      <p className="destination-workspace-note" role="status">
        {message} Copy your prompt, then paste it into the destination. Google
        may reject embedded sign-in.
      </p>
      <div ref={host} className="destination-webview-host">
        <p>Opening the native destination workspace…</p>
      </div>
    </section>
  );
}
