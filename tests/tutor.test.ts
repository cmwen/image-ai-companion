import { expect, it } from "vitest";
import {
  OfflineTutor,
  tutorSystemPrompt,
} from "../src/features/tutor/provider";
import { buildPrompt } from "../src/features/prompt-builder/builder";
it("keeps offline tutor behavior explicit and honors provider prompt contract", async () => {
  const tutor = new OfflineTutor();
  const intent = {
    subject: "A robot",
    environment: "",
    conceptIds: [],
    mood: "",
    constraints: "No text",
    destinationId: "chatgpt" as const,
  };
  expect(await tutor.buildPrompt(intent)).toEqual(buildPrompt(intent));
  const guidance = await tutor.chat({ message: "What could I try?", intent });
  expect(guidance.source).toBe("offline");
  expect(guidance.text).toContain("Choose one");
  expect(tutorSystemPrompt).toContain("Never claim");
});
