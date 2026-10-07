import { isTauri } from "@tauri-apps/api/core";
import type { DestinationId } from "../../types/domain";
export interface DestinationCapabilities {
  clipboard: boolean;
  externalBrowser: boolean;
  embedded: boolean;
}
export interface CreativeDestination {
  id: DestinationId;
  name: string;
  url: string;
  open(): Promise<void>;
  copyPrompt(prompt: string): Promise<void>;
  getCapabilities(): DestinationCapabilities;
}
export function createDestination(id: DestinationId): CreativeDestination {
  const url =
    id === "chatgpt" ? "https://chatgpt.com/" : "https://flow.google.com/";
  return {
    id,
    name: id === "chatgpt" ? "ChatGPT" : "Google Flow",
    url,
    getCapabilities: () => ({
      clipboard: true,
      externalBrowser: true,
      embedded: isTauri(),
    }),
    async open() {
      if (isTauri()) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
      } else {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (opened === null) {
          /* noopener may return null even on success; browser controls opening */
        }
      }
    },
    async copyPrompt(prompt) {
      if (!prompt.trim()) throw new Error("Build a prompt before copying.");
      if (isTauri()) {
        const { writeText } =
          await import("@tauri-apps/plugin-clipboard-manager");
        await writeText(prompt);
      } else {
        if (!navigator.clipboard)
          throw new Error(
            "Clipboard unavailable. Select the prompt and copy it manually.",
          );
        await navigator.clipboard.writeText(prompt);
      }
    },
  };
}
