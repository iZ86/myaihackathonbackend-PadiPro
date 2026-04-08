import { z } from "genkit";

export const ChatInputSchema = z.object({
  message: z.string().describe("User message"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string(),
      })
    )
    .optional(),
});

export const ChatOutputSchema = z.object({
  reply: z.string(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
