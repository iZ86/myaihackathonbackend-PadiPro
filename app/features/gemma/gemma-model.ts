import { z } from "genkit";
import { MessageSchema } from "genkit/model";
import { genkit, SessionStore, SessionData } from "genkit/beta";

export const ChatInputSchema = z.object({
  mobile_no: z.string().describe("Mobile number of user"),
  message: z.string().describe("User message"),
  image_url: z
    .string()
    .describe("Download URL for the uploaded media")
    .refine((val) => val.startsWith('http'), "Must be a valid Data URL or media link")
    .optional()
});

export const ChatOutputSchema = z.object({
  reply: z.string(),
  prompt: z.string().describe("The customized prompt to send into Vertex").optional(),
  vertexOutput: z.string().describe("Status code to determine next course of action"),
});

export const ChatHistorySchema = z.object({
  content: ChatOutputSchema,
  role: z.enum(["model", "tool", "editor", "user", "system"]),
  timestamp: z.string(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export type Message = z.infer<typeof MessageSchema>;