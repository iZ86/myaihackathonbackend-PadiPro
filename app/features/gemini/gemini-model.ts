import { z } from "genkit";

export const ChatInputSchema = z.object({
  message: z.string().describe("User message"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export const ChatOutputSchema = z.object({
  reply: z.string(),
});

export const MediaInputSchema = z.object({
  media_url: z
    .string()
    .describe("Downloadable URL of media")
    .refine(
      (val) => val.startsWith("http"),
      "Must be a valid Data URL or media link",
    ), // We'll be using the downloadable link in the firestore ya
});

const MediaOutputDetectionSchema = z.object({
  disease: z.string(),
  severity: z.number().min(0).max(1).describe("The severity score from 0 to 1"),
  score: z.number().min(0).max(1).describe("The confidence score of the model"),
});

export const MediaOutputSchema = z.object({
  detections: z
    .array(MediaOutputDetectionSchema)
    .describe("List of all detected diseases with metadata"),
  chart: z.string().describe("Base64 encoded PNG buffer").optional(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
export type MediaInput = z.infer<typeof MediaInputSchema>;
export type MediaOutput = z.infer<typeof MediaOutputSchema>;
export type MediaOutputDetection = z.infer<typeof MediaOutputDetectionSchema>;
