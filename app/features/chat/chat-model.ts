import { z } from "genkit";
import { MessageSchema } from "genkit/model";

export const ChatInputSchema = z.object({
  mobile_no: z.string().describe("Mobile number of user"),
  created_by: z.enum(["WHATSAPP", "WEBCHAT", "BASE"]).describe("Which platform the message came from"),
  message: z.string().describe("User message").optional(),
  media_type: z.enum(["image", "video", "audio", "document"]).describe("Type of the media uploaded, if any").optional(),
  media_url: z
    .string()
    .describe("Download URL for the uploaded media")
    .refine((val) => val.startsWith("http"), "Must be a valid Data URL or media link")
    .optional(),
  media_name: z.string().describe("Name for the uploaded media").optional(),
});

export const ChatOutputMessageSchema = z.object({
  message: z.string().describe("The reply sent back to users"),
  type: z
    .enum(["text", "media"])
    .describe("Whether the message is text or media, if media, the message field will be a Base64 string"),
  document_url: z.string().describe("The downloadable URL of the solutions document sent, if any").optional(),
});

export const ChatOutputSchema = z.object({
  messages: z.array(ChatOutputMessageSchema),
});

// Database level schema for chat history
export const ChatHistorySchema = z.object({
  role: z.enum(["user", "model"]).describe("Who wrote the prompt"),
  timestamp: z.string(),
  message: z.string().describe("The reply you will send back to users").optional(),
  media_type: z.enum(["image", "video", "audio", "document"]).describe("Type of the media uploaded, if any").optional(),
  media_url: z.string().describe("The downloadable URL of the media sent, if any").optional(),
  media_name: z.string().describe("Name for the uploaded media").optional(),
});

// Specific model for the Gemini 3.1 Genkit flow
export const ChatFlowInputSchema = z.object({
  mobile_no: z.string().describe("Mobile number of user"),
  created_by: z.enum(["WHATSAPP", "WEBCHAT", "BASE"]).describe("Which platform the message came from"),
});

export const ChatFlowOutputSchema = z.object({
  reply: z.string().describe("The reply you will send back to users"),
  prompt: z.string().describe("The customized prompt to send into Vertex based off the user's message").optional(),
  vertexOutput: z
    .boolean()
    .describe("Whether Vertex is required to search up relevant information to answer the user's query")
    .optional(),
});

//timeline json format from vertex response
export interface TimelineSolution {
  day: string;
  solution: string;
  description: string;
}

export const ChatOutputWebSchema = z.object({});

export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
export type ChatOutputMessage = z.infer<typeof ChatOutputMessageSchema>;
export type ChatFlowInput = z.infer<typeof ChatFlowInputSchema>;
export type ChatFlowOutput = z.infer<typeof ChatFlowOutputSchema>;
export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export type Message = z.infer<typeof MessageSchema>;
