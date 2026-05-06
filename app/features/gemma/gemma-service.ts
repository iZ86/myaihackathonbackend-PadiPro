import "dotenv/config";
import { genkit, SessionStore } from "genkit/beta";
import { MessageSchema } from "genkit/model";
import { googleAI } from "@genkit-ai/google-genai";
import { ChatInputSchema, ChatOutputSchema, ChatOutput, ChatInput, Message } from "./gemma-model";
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
    const store: SessionStore<any> = {
      get: async (id) => {
        const history = await gemmaRepository.getChatHistory(id, "whatsapp") ?? [];
        const formattedHistory: Message[] = history.slice(-15).map((msg) => ({
          role: msg.role === "editor" ? "model" : msg.role, 
          content: [
            { 
              text: msg.content.reply,
              metadata: {
                vertexOutput: msg.content.vertexOutput,
                prompt: msg.content.prompt
              }
            }
          ],
          timestamp: msg.timestamp,
        }));

        return {
          id,
          state: null,
          threads: { 
            main: formattedHistory,
          }
        };
      },
      save: async (id, data) => {
        const latest = data.threads?.main?.at(-1);
        if (latest) {
          const chatHistory = {
            content: JSON.parse(latest.content[0]?.text ?? ''),
            role: latest.role,
            timestamp: "",
          }
          await gemmaRepository.saveChatHistory(id, "whatsapp", chatHistory);
        }
      }
    };

    let session;
    try {
      session = await ai.loadSession(input.mobile_no, { store });
    } catch {
      session = ai.createSession({
        sessionId: input.mobile_no,
        store
      });
    }

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