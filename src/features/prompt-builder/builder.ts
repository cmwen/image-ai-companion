import type { CreativeIntent, GeneratedPrompt } from "../../types/domain";
import { concepts } from "../../lib/content";
export function buildPrompt(intent: CreativeIntent): GeneratedPrompt {
  const sections: GeneratedPrompt["sections"] = [];
  const add = (label: string, text: string, explanation: string) => {
    if (text.trim()) sections.push({ label, text: text.trim(), explanation });
  };
  add(
    "Subject",
    intent.subject,
    "Tell the destination what the image should focus on.",
  );
  add(
    "Environment",
    intent.environment,
    "Give the subject a place and context.",
  );
  for (const id of [...new Set(intent.conceptIds)]) {
    const c = concepts.find((x) => x.id === id);
    if (c) add(c.title, c.promptExamples[0], c.whyItMatters);
  }
  add(
    "Mood",
    intent.mood,
    "Describe the feeling you want the scene to convey.",
  );
  add(
    "Constraints",
    intent.constraints,
    "Keep practical requirements explicit.",
  );
  return {
    text: sections.map((x) => x.text).join(". ") + (sections.length ? "." : ""),
    sections,
  };
}
export function simplifyPrompt(intent: CreativeIntent): GeneratedPrompt {
  return buildPrompt({ ...intent, conceptIds: intent.conceptIds.slice(0, 2) });
}
