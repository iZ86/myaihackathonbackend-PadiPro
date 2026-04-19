import "dotenv/config";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { ChatInput, ChatInputSchema, ChatOutputSchema, ChatOutput, ImageInput, ImageOutput, ImageOutputSchema, ImageInputSchema } from "./gemini-model";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { geminiServiceConfig } from "../../config/config";
import { ENUM_PADDY_DISEASE } from "./gemini-enums";

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiServiceConfig.GEMINI_API_KEY })],
  model: googleAI.model("gemini-2.5-flash"),
});

interface IGeminiService {
  chat(input: ChatInput): Promise<Result<ChatOutput>>;
  image(input: ImageInput): Promise<Result<ImageOutput>>;
}

class GeminiService implements IGeminiService {
  public readonly chatFlow = ai.defineFlow(
    {
      name: "chatFlow",
      inputSchema: ChatInputSchema,
      outputSchema: ChatOutputSchema,
    },
    async ({ message, history = [] }) => {
      const messages = [
        ...history.map((h) => ({
          role: h.role as "user" | "model",
          content: [{ text: h.content }],
        })),
        { role: "user" as const, content: [{ text: message }] },
      ];

      const { text } = await ai.generate({ messages });
      return { reply: text };
    }
  );
  
  public readonly imageFlow = ai.defineFlow(
    {
      name: "imageFlow",
      inputSchema: ImageInputSchema,
      outputSchema: ImageOutputSchema,
    },
    async ({ image_url }) => {
      const diseaseList = Object.values(ENUM_PADDY_DISEASE)
        .filter((v) => typeof v === 'string')
        .join(", ");

      const systemPrompt = `
        You are an expert in diagnosing paddy plant diseases. 
        Analyze the image and provide a diagnosis based on these rules:

        - If the image is not a paddy plant: return "NOT DETECTED" with severity 0.
        - If the plant is healthy: return "HEALTHY" with severity 0.
        - If a disease is found: return the name from this list: [${diseaseList}].

        For severity: Provide a score from 0.0 to 1.0 (0 is healthy, 1.0 is total crop failure).
      `;

      const { output } = await ai.generate({
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { text: "Analyze this image for paddy disease and estimate severity." },
              { media: { url: image_url, contentType: "image/jpeg" } },
            ],
          },
        ],
        output: {
          schema: ImageOutputSchema,
        },
      });

      return {
        disease: output?.disease ?? "NOT DETECTED",
        severity: output?.severity ?? 0,
      };
    }
  );

  public async chat(input: ChatInput): Promise<Result<ChatOutput>> {
    const output = await this.chatFlow(input);

    if (!output?.reply) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "AI failed to generate a reply.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Chat response generated.");
  }
  
  public async image(input: ImageInput): Promise<Result<ImageOutput>> {
    const output = await this.imageFlow(input);

    if (!output?.disease) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "AI failed to read the image.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Diagnosis generated.");
  }
}

export default new GeminiService();
