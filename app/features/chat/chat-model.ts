import { z } from "genkit";
import { MessageSchema } from "genkit/model";

export const ChatInputSchema = z.object({
    mobile_no: z.string().describe("Mobile number of user"),
    created_by: z.enum(["WHATSAPP", "WEBCHAT", "BASE"]).describe("Which platform the message came from"),
    message: z.string().describe("User message").optional(),
    media_url: z
        .string()
        .describe("Download URL for the uploaded media")
        .refine((val) => val.startsWith("http"), "Must be a valid Data URL or media link")
        .optional(),
    media_name: z.string().describe("Name for the uploaded media").optional(),
});

export const ChatOutputSchema = z.object({
    reply: z.string().describe("The reply you will send back to users"),
    prompt: z.string().describe("The customized prompt to send into Vertex based off the user's message").optional(),
    vertexOutput: z.enum(["JSON", "TEXT"]).describe("Status code to determine next course of action").optional(),
});

export const ChatHistorySchema = z.object({
    role: z.enum(["user", "model"]).describe("Who wrote the prompt"),
    timestamp: z.string(),
    message: z.string().describe("The reply you will send back to users").optional(),
    media_url: z.string().describe("The downloadable URL of the media sent, if any").optional(),
    media_name: z.string().describe("Name for the uploaded media").optional(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export type Message = z.infer<typeof MessageSchema>;
