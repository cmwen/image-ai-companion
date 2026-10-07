import { z } from "zod";
import data from "../../content/library.json";
const category = z.enum([
  "style",
  "composition",
  "camera",
  "lighting",
  "colour",
  "art-direction",
]);
const difficulty = z.enum(["beginner", "intermediate", "advanced"]);
const concept = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category,
  shortDescription: z.string().min(1),
  whyItMatters: z.string().min(1),
  whenToUse: z.array(z.string()).min(1),
  promptExamples: z.array(z.string()).min(1),
  relatedConceptIds: z.array(z.string()),
  difficulty,
});
const intent = z.object({
  subject: z.string(),
  environment: z.string(),
  conceptIds: z.array(z.string()),
  mood: z.string(),
  constraints: z.string(),
  destinationId: z.enum(["chatgpt", "flow"]),
});
const recipe = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  intent,
});
const exercise = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  objective: z.string(),
  starterPrompt: z.string(),
  conceptIds: z.array(z.string()),
  difficulty,
});
export function validateContent(input: unknown) {
  const parsed = z
    .object({
      concepts: z.array(concept).min(1),
      recipes: z.array(recipe).min(1),
      exercises: z.array(exercise).min(1),
    })
    .parse(input);
  for (const collection of [parsed.concepts, parsed.recipes, parsed.exercises])
    if (new Set(collection.map((x) => x.id)).size !== collection.length)
      throw new Error("Duplicate content identifier");
  const ids = new Set(parsed.concepts.map((x) => x.id));
  for (const refs of [
    ...parsed.concepts.map((x) => x.relatedConceptIds),
    ...parsed.recipes.map((x) => x.intent.conceptIds),
    ...parsed.exercises.map((x) => x.conceptIds),
  ])
    for (const id of refs)
      if (!ids.has(id)) throw new Error(`Unknown concept: ${id}`);
  return parsed;
}
export const { concepts, recipes, exercises } = validateContent(data);
