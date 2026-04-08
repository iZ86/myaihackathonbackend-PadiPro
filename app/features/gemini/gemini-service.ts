import "dotenv/config";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { ChatInput, ChatInputSchema, ChatOutputSchema, ChatOutput } from "./gemini-model";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { geminiServiceConfig } from "../../config/config";

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiServiceConfig.GEMINI_API_KEY })],
  model: googleAI.model("gemini-2.5-flash"),
});

class GeminiService {
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

  public async chat(input: ChatInput): Promise<Result<ChatOutput>> {
    const output = await this.chatFlow(input);

    if (!output?.reply) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "AI failed to generate a reply.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Chat response generated.");
  }
}

export default new GeminiService();
