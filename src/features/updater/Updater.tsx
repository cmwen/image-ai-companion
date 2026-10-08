import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { createUpdater, type UpdateState } from "./controller";
// One controller survives React StrictMode's setup/cleanup/setup cycle, preventing
// duplicate checks or loss of an installed update during component remounts.
const updater = createUpdater({ check, restart: relaunch });
export default function Updater() {
  const [state, setState] = useState<UpdateState>(updater.getState());
  const native = isTauri();
  useEffect(() => {
    if (!native) return;
    const unsubscribe = updater.subscribe(setState);
    updater.start();
    return () => {
      unsubscribe();
      updater.stop();
    };
  }, [native]);
  if (!native) return null;
  const working = [
    "checking",
    "downloading",
    "installing",
    "restarting",
  ].includes(state.phase);
  return (
    <div className="updater">
      <button
        className="small"
        disabled={working}
        onClick={() =>
          void (state.phase === "ready" ? updater.restart() : updater.check())
        }
      >
        {state.phase === "ready" ? "Restart to update" : "Check for updates"}
      </button>
      {state.message && <span role="status">{state.message}</span>}
      {state.progress !== undefined && state.phase === "downloading" && (
        <progress
          aria-label="Update download"
          value={state.progress}
          max={100}
        />
      )}
    </div>
  );
}
