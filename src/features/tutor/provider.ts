import type { CreativeIntent, GeneratedPrompt } from "../../types/domain";
import { buildPrompt } from "../prompt-builder/builder";
import systemPrompt from "../../../prompts/visual-tutor-system.md?raw";
export interface TutorResponse {
  text: string;
  source: "offline" | "model";
}
export interface TutorModel {
  chat(request: {
    message: string;
    intent: CreativeIntent;
  }): Promise<TutorResponse>;
  buildPrompt(intent: CreativeIntent): Promise<GeneratedPrompt>;
}
export const tutorSystemPrompt = systemPrompt;
export class OfflineTutor implements TutorModel {
  async buildPrompt(intent: CreativeIntent) {
    return buildPrompt(intent);
  }
  async chat({
    intent,
  }: {
    message: string;
    intent: CreativeIntent;
  }): Promise<TutorResponse> {
    return {
      source: "offline",
      text: intent.conceptIds.length
        ? "Try changing just one selected concept, then compare the two results. Keeping the rest fixed makes the effect easier to see."
        : "Choose one lighting or composition concept and compare the result with your original idea.",
    };
  }
}
