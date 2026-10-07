import { z } from "zod";
export type DestinationId = "chatgpt" | "flow";
export interface CreativeIntent {
  subject: string;
  environment: string;
  conceptIds: string[];
  mood: string;
  constraints: string;
  destinationId: DestinationId;
}
export interface GeneratedPrompt {
  text: string;
  sections: { label: string; text: string; explanation: string }[];
}

export const creativeIntentSchema = z.object({
  subject: z.string(),
  environment: z.string(),
  conceptIds: z.array(z.string()),
  mood: z.string(),
  constraints: z.string(),
  destinationId: z.enum(["chatgpt", "flow"]),
});
