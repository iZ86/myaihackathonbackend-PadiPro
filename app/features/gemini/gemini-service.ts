import "dotenv/config";
import { genkit, GenkitError } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { ChatInput, ChatInputSchema, ChatOutputSchema, ChatOutput, ImageInput, ImageOutput, ImageOutputSchema, ImageInputSchema } from "./gemini-model";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { geminiServiceConfig } from "../../config/config";
import { ENUM_PADDY_DISEASE } from "./gemini-enums";

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiServiceConfig.GEMINI_API_KEY })],
  model: googleAI.model("gemini-3-flash-preview"),
});

interface IGeminiService {
  chat(input: ChatInput): Promise<Result<ChatOutput>>;
  image(image_url: string): Promise<Result<ImageOutput>>;
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

        For disease:
        - If the image is not a paddy plant: return "NOT DETECTED" with severity 0.
        - If the plant is healthy: return "HEALTHY" with severity 0.
        - If a disease is found: return the name from this list: [${diseaseList}].

        For severity: 
        - Provide a score from 0.0 to 1.0 (0 is healthy, 1.0 is total crop failure).

        For confidence:
        - Provide a score from 0.0 to 1.0 (0 means not detected, 1.0 is absolutely sure the disease is on the plant.)
        
        For detections:
        - Provide any disease found with a score of > 0.4, else you can skip adding them.
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
        detections: output?.detections ?? [], 
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

  public async image(image_url: string): Promise<Result<ImageOutput>> {

    const input: ImageInput = {
      image_url
    };

    try {

      const output = await this.imageFlow(input);

      if (!output?.disease) {
        return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "AI failed to read the image.");
      }

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Diagnosis generated.");


    } catch (error) {

      if (error instanceof GenkitError) {
        let errorMessage: string = error.message;

        if (error.detail) {
          if (error.detail.error) {
            if (error.detail.error.message) {
              errorMessage = error.detail.error.message;
            }
          }
        }
        if (error.code === 503) {
          return Result.fail(ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE, errorMessage);
        } else if (error.code === 429) {
          return Result.fail(ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS, errorMessage);
        }
      }

      throw error;
    }
  }


}

export default new GeminiService();
