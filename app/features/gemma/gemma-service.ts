import "dotenv/config";
import { genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/google-genai";
import { ChatInputSchema, ChatOutputSchema, ChatOutput, ChatHistory, ChatInput, } from "./gemma-model";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { geminiServiceConfig } from "../../config/config";
import gemmaRepository from "./gemma-repository";

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiServiceConfig.GEMINI_API_KEY }),],
  model: googleAI.model("gemma-4-26b-a4b-it"),
});

interface IGemmaService {
  chat(input: ChatInput): Promise<Result<ChatOutput>>;
}

class GemmaService implements IGemmaService {
  public readonly gemmaChatFlow = ai.defineFlow(
    {
      name: 'gemmaChatFlow',
      inputSchema: ChatInputSchema,
      outputSchema: ChatOutputSchema,
    },
    async (input) => {
      const result = await this.chat(input);
      if (result.isFailure()) {
        throw new Error("Chat flow failed to generate a response.");
      }

      const chatOutput = result.getData();

      return {
        reply: chatOutput.reply,
        vertexOutput: chatOutput.vertexOutput,
        prompt: input.message,
      };
    }
  );

  public async chat(input: ChatInput): Promise<Result<ChatOutput>> {
    console.log("[Gemma] Input entered:", input);
    const store = {
      get: async (id: string) => {
        const history = await gemmaRepository.getChatHistory(id, "whatsapp") ?? [];
        const contextMessages = history.slice(-15);
        console.log(`[Gemma] Providing ${contextMessages.length} messages of context.`);
        return { 
          id: id,
          messages: contextMessages
        };
      },
      save: async (mobile_no: string, data: any) => {
        console.log("[Gemma] Saving into chat_history for user:", mobile_no);
        const messages = (data && data.messages) ? data.messages : [];
        const latestMessage = messages[messages.length - 1];
        if (latestMessage) {
          await gemmaRepository.saveChatHistory(mobile_no, "whatsapp", latestMessage);
        }
      }
    };

    const session = ai.createSession({
      sessionId: input.mobile_no,
      store: store
    });

    const chat = session.chat();
    const { output } = await chat.send({
      prompt: `INSTRUCTION: Remember what users say. Always provide a reply and vertexOutput status code.
                USER MESSAGE: ${input.message}`,
      output: {
        schema: ChatOutputSchema
      }
    });

    if (!output) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "Model failed to generate structured output.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Chat response generated.");
  }
}

export default new GemmaService();