import "dotenv/config";
import { Chat, genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/google-genai";
import {
  ChatInputSchema,
  ChatOutputSchema,
  ChatOutput,
  ChatInput,
  ChatFlowInputSchema,
  ChatFlowOutputSchema,
  ChatOutputMessage,
  ChatFlowOutput,
} from "./chat-model";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { geminiServiceConfig } from "../../config/config";
import chatRepository from "./chat-repository";
import { WhatsappRawValue } from "../whatsapp/whatsapp-model";
import whatsappService from "../whatsapp/whatsapp-service";
import { UserData } from "../user/user-model";
import userService from "../user/user-service";
import { MediaOutput } from "../gemini/gemini-model";
import geminiService from "../gemini/gemini-service";
import mediaService from "../media/media-service";
import { MediaData } from "../media/media-model";
import { create } from "domain";
import { VertexAnswerQueryData, VertexSessionInfoData } from "../vertex/vertex-model";
import vertexService from "../vertex/vertex-service";
import { WeatherData } from "../weather/weather-model";
import weatherService from "../weather/weather-service";

const ai = genkit({
  plugins: [googleAI({ apiKey: geminiServiceConfig.GEMINI_API_KEY })],
  model: googleAI.model("gemini-3.1-flash-lite-preview"),
});

interface IChatService {
  chat(input: WhatsappRawValue): Promise<Result<ChatOutput | string>>;
}

class ChatService implements IChatService {
  private messages: ChatOutputMessage[] = [];
  private userVertexSession: { [mobile_no: string]: string } = {};

  public readonly chatFlow = ai.defineFlow(
    {
      name: "chatFlow",
      inputSchema: ChatFlowInputSchema,
      outputSchema: ChatFlowOutputSchema,
    },
    async ({ mobile_no, created_by }) => {
      // Get chat history
      const chatHistory = await chatRepository.getChatHistory(mobile_no, created_by);
      if (!chatHistory) {
        throw new Error(`Failed to retrieve chat history for mobile_no: ${mobile_no}`);
      }

      // Flatten responses since Genkit must have the order of messages be User -> Model -> User and so forth
      const processedHistory = chatHistory.slice(-16).reduce((acc: any[], item) => {
        const role = (item.role === "user" ? "user" : "model") as "user" | "model";
        const lastMessage = acc[acc.length - 1];

        if (lastMessage && lastMessage.role === role) {
          lastMessage.content.push({ text: item.message ?? "" });
        } else {
          acc.push({
            role: role,
            content: [{ text: item.message ?? "" }],
          });
        }
        return acc;
      }, []);
      while (processedHistory.length > 0 && processedHistory[0].role === "model") {
        processedHistory.shift();
      }

      // System Prompt
      const systemPrompt = `
          Based on the chat history and newest message from the user, return the following in a contextual manner.

          {
              vertexOutput:
                  - You may leave this unset if the question or request from the user does not require information regarding paddy plant diseases, otherwise set to one of the following:
                      1. JSON: The user requests for a solution or timeline-based plan
                      2. TEXT: The user simply wants feedback on something

              prompt:
                  - You may again leave this empty if vertexOutput was left empty, as this query will be sent to Vertex Search to look up information regarding user queries.
                  - You are to generate the contextualized query for Vertex based on users previous messages.

              message:
                  - The reply you will give back to the user, mandatory field.

              For example, if users asked a question regarding stem rot previously, and the latest message is asking for solutions, you may set it so:
                  vertexOutput: "JSON",
                  prompt: "Provide a 7-day solution plan to solve stem rot in a paddy field." (this will be sent directly to Vertex Search)
                  message: "Please wait a moment as I generate a timeline solution for you..."
          }
      `;

      // Parse data into Gemini 3.1
      const { output } = await ai.generate({
        system: systemPrompt,
        messages: processedHistory,
        output: {
          schema: ChatFlowOutputSchema,
        },
      });
      if (!output) {
        throw new Error("AI failed to generate a response");
      }
      return output;
    },
  );

  public async chat(input: WhatsappRawValue | ChatInput): Promise<Result<ChatOutput>> {
    let chatInput: ChatInput = {
      mobile_no: "",
      created_by: "BASE",
    };

    // Extract data according to source
    if (this.isWhatsappInput(input)) {
      const rawMsg = input.messages?.[0];
      const contact = input.contacts?.[0];
      const meta = input.metadata;
      const message = whatsappService.parse(rawMsg!, contact, meta);

      if (contact && contact.wa_id) {
        const mobile_no: string = contact.wa_id;

        let newUser: boolean = false;
        let userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

        if (userResult.isFailure()) {
          userResult = await userService.createUser(contact.wa_id, contact.profile.name);
          newUser = true;
        }

        if (userResult.isSuccess()) {
          const user: UserData = userResult.getData();
          const locationExist: boolean = !!user.coords;

          const whatsappMessageFormatted = await whatsappService.handle(
            message,
            userResult.getData(),
            newUser,
            locationExist,
          );
          if (whatsappMessageFormatted != null) {
            chatInput = whatsappMessageFormatted;
          }
        }
      }
    } else if (this.isWebchatInput(input)) {
      chatInput = {
        mobile_no: "",
        created_by: "WEBCHAT",
      };
    } else {
      chatInput = input;
    }

    // Deconstruct variables for easier access
    const { mobile_no, created_by, message, media_url, media_name } = chatInput;
    const mediaName = media_name ?? "";

    // Save user message into chat history
    const saveChatHistoryResult = await chatRepository.saveChatHistory(mobile_no, created_by, {
      role: "user",
      timestamp: "",
      message: message ?? "",
      media_url: media_url ?? "",
      media_name: media_name ?? "",
    });
    if (!saveChatHistoryResult) {
      console.log("[Chat] Failed message", message);
      console.log("[Chat] Failed media URL", media_url);
      console.log("[Chat] Failed media name", media_name);
      throw Error(`Failed to save chat history.`);
    }

    // Send media Gemini 3.0 for image diagnosis first if media_url exists
    if (media_url && media_url != "") {
      const mediaResult: Result<string> = await this.handleMedia(mobile_no, mediaName, "WHATSAPP", message ?? "");
      if (mediaResult.isFailure()) {
        this.sendText(mobile_no, created_by, mediaResult.getMessage());
        return Result.fail(mediaResult.getStatusCode(), mediaResult.getMessage());
      }
    }

    // Send text directly into Gemini 3.1 for chat response generation
    if (message) {
      const output = await this.chatFlow(chatInput);
      if (!output?.reply) {
        throw Error(`AI failed to generate a reply.`);
      }
      const textResult: Result<string> = await this.handleText(mobile_no, created_by, output);
      if (textResult.isFailure()) {
        this.sendText(mobile_no, created_by, textResult.getMessage());
        return Result.fail(textResult.getStatusCode(), textResult.getMessage());
      }
    }
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, { messages: this.messages }, "Chat response generated.");
  }

  // Handling text and audio messages post transcription
  private async handleText(mobile_no: string, type: string, flowOutput: ChatFlowOutput): Promise<Result<string>> {
    const { vertexOutput, prompt, reply } = flowOutput;

    // Send the base message generated from Gemini 3.1 first
    await this.sendText(mobile_no, type, reply);

    // Run Vertex Search if Gemini 3.1 thinks we need it
    if (vertexOutput && prompt && prompt !== "") {
      // Get weather query via Google Weather API
      await this.syncUserWeather(mobile_no);
      const weatherQuery: string = await this.generateWeatherQuery(mobile_no);

      // Start Vertex, can consider dropping the session
      const session: string = await this.getOrCreateVertexSession(mobile_no);

      // Parse custom query and weather query appended into Vertex
      const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(
        prompt + weatherQuery,
        session,
      );
      const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();

      if (
        sendQueryVertex.answer.answerText ===
        "A summary could not be generated for your search query. Here are some search results."
      ) {
        await this.sendText(
          mobile_no,
          type,
          "I specialize in rice paddy disease analysis. Could you clarify how your question relates to crop health?",
        );
      } else {
        await this.sendText(mobile_no, type, sendQueryVertex.answer.answerText);
      }
    }
    return Result.succeed(
      ENUM_STATUS_CODES_SUCCESS.OK,
      "Vertex successfully analyzed text and provided solution",
      "handleText success.",
    );
  }

  // Handling images and videos with same function due to similar if not identical flow
  private async handleMedia(
    mobile_no: string,
    mediaName: string,
    type: string,
    caption: string,
  ): Promise<Result<string>> {
    const mediaResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(mediaName);
    if (mediaResult.isFailure()) {
      throw new Error(`handleMedia failed to retrieve media: ${mediaResult.getMessage()}`);
    }
    const media: MediaData = mediaResult.getData();

    const geminiMediaResult: Result<MediaOutput> = await geminiService.media(media.download_url);
    if (geminiMediaResult.isFailure()) {
      const deleteMediaResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
      if (deleteMediaResult.isFailure()) {
        throw new Error(`handleMedia delete media failed: ${deleteMediaResult.getMessage()}`);
      }

      if (
        geminiMediaResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE &&
        geminiMediaResult.getMessage() ===
          "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
      ) {
        return Result.fail(
          ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE,
          "We are currently experiencing high demand, please try again later.",
        );
      } else if (
        geminiMediaResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS &&
        geminiMediaResult.getMessage() === "Resource has been exhausted (e.g. check quota)."
      ) {
        return Result.fail(
          ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS,
          "You are sending messages too frequently, please send again in 1 minute.",
        );
      }
      throw Error(
        `handleMedia error, gemini error code ${geminiMediaResult.getStatusCode()}: ${geminiMediaResult.getMessage()}`,
      );
    }

    const mediaOutput: MediaOutput = geminiMediaResult.getData();
    if (mediaOutput.detections[0]?.disease === "NOT DETECTED") {
      const deleteMediaResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
      if (deleteMediaResult.isFailure()) {
        throw new Error(`handleMedia delete media failed: ${deleteMediaResult.getMessage()}`);
      }
      await this.sendText(
        mobile_no,
        type,
        "We could not detect any paddy plants in the image or video you sent, please try again.",
      );
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "", "handleMedia success.");
    } else if (mediaOutput.detections[0]?.disease === "HEALTHY") {
      const media: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(
        mediaName,
        mediaOutput.detections,
      );
      if (media.isFailure()) {
        throw new Error(`handleMedia failed to update media diagnosis: ${media.getMessage()}`);
      }
      await this.sendText(
        mobile_no,
        type,
        "No visible signs of disease detected. The rice plants appear healthy based on this image.",
      );
    } else {
      const media: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(
        mediaName,
        mediaOutput.detections,
      );
      if (media.isFailure() || !mediaOutput.detections[0]) {
        throw new Error(`handleMedia failed to update media diagnosis: ${media.getMessage()}`);
      }
      const diseaseName = mediaOutput.detections[0].disease;
      await this.sendText(
        mobile_no,
        type,
        `The image you sent has been analyzed and shows signs of ${diseaseName}. ${caption ?? ""}`,
      );

      // Provide default message if diagnosis is not provided
      if (!caption || caption === "") {
        await this.sendText(mobile_no, type, "Would you like to know more about the diagnosis?");
      }
    }
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "Media successfully analyzed.", "handleMedia success.");
  }

  // Shared function between webchat and whatsapp due to identical structure
  public async handleLocation(mobile_no: string, latitude: number, longitude: number): Promise<Result<UserData>> {
    const userResult: Result<UserData> = await userService.updateUserCoordsByMobileNo(latitude, longitude, mobile_no);
    if (userResult.isFailure()) {
      return Result.fail(userResult.getStatusCode(), userResult.getMessage());
    }

    const user: Result<UserData> = await userService.getUserByMobileNo(mobile_no);
    if (user.isFailure()) {
      return Result.fail(user.getStatusCode(), user.getMessage());
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, user.getData(), "handleLocation success.");
  }

  // Validate if the input is from Whatsapp
  private isWhatsappInput(input: any): input is WhatsappRawValue {
    return input && typeof input === "object" && "messaging_product" in input;
  }

  // Validate if the input is from Sky's frontend webchat
  private isWebchatInput(input: any): input is WhatsappRawValue {
    return input && typeof input === "object" && "messaging_product" in input;
  }

  private async sendText(mobile_no: string, type: string, message: string): Promise<void> {
    const saveChatHistoryResult = await chatRepository.saveChatHistory(mobile_no, type.toLowerCase(), {
      role: "user",
      timestamp: "",
      message: message ?? "",
    });
    if (!saveChatHistoryResult) {
      throw Error(`Failed to save chat history.`);
    }

    if (type.toUpperCase() === "WHATSAPP") {
      whatsappService.sendText(mobile_no, message);
    }

    this.messages.push({
      message: message,
      type: "text",
    });
  }

  private async syncUserWeather(mobile_no: string): Promise<undefined> {
    const getWeatherResult: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobile_no);

    if (getWeatherResult.isSuccess()) {
      const updateWeatherResult: Result<WeatherData> = await weatherService.updateWeather(mobile_no);

      if (
        updateWeatherResult.isFailure() &&
        ((updateWeatherResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.NOT_FOUND &&
          updateWeatherResult.getMessage() !== "User location is not set.") ||
          updateWeatherResult.getStatusCode() !== ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS)
      ) {
        throw new Error(`handleText had issue with updateWeather: ${updateWeatherResult.getMessage()}`);
      }
    } else if (getWeatherResult.isFailure() && getWeatherResult.getMessage() === "User weather not found.") {
      const saveWeatherResult: Result<WeatherData> = await weatherService.saveWeather(mobile_no);

      if (saveWeatherResult.isFailure() && saveWeatherResult.getMessage() !== "User location is not set.") {
        throw new Error(`handleText had issue with saveWeather: ${saveWeatherResult.getMessage()}`);
      }
    } else {
      throw new Error("handleText failed to get weather.");
    }
  }

  private async generateWeatherQuery(mobile_no: string): Promise<string> {
    const weatherResult: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobile_no);

    let weatherQuery: string = "";

    if (weatherResult.isSuccess()) {
      const weather: WeatherData = weatherResult.getData();
      const condition = weather.weatherCondition?.replace(/_/g, " ").toLowerCase();
      const temp = `${weather.temperature?.degrees}°${weather.temperature?.unit === "CELSIUS" ? "C" : "F"}`;
      const feelsLike = weather.dewPoint ? `dew point ${weather.dewPoint.degrees}°C` : "";
      const humidity = `humidity ${weather.relativeHumidity}%`;
      const wind = `wind ${weather.wind?.speed?.value} ${weather.wind?.speed?.unit?.replace(/_/g, " ").toLowerCase()} from ${weather.wind?.direction?.cardinal?.replace(/_/g, " ")}`;
      const gusts = weather.wind?.gust?.value ? `, gusting to ${weather.wind.gust.value} km/h` : "";
      const cloud = `cloud cover ${weather.cloudCover}%`;
      const rainChance = `${weather.precipitation?.probability?.percent}% chance of ${weather.precipitation?.probability?.type?.toLowerCase()}`;
      const thunderChance = (weather.thunderstormProbability ? weather.thunderstormProbability > 0 : false)
        ? `, ${weather.thunderstormProbability}% chance of thunderstorms`
        : "";
      const qpf = (weather.precipitation?.qpf.quantity ? weather.precipitation?.qpf?.quantity > 0 : false)
        ? `, expected rainfall ${weather.precipitation?.qpf.quantity} ${weather.precipitation?.qpf.unit.toLowerCase()}`
        : "";

      weatherQuery =
        "\nAdditionally, here are the current weather conditions that you may reference when tailoring the personalized solution plan: " +
        `\nCurrent weather conditions:` +
        `\n- Condition: ${condition}` +
        `\n- Temperature: ${temp}, ${feelsLike}, ${humidity}` +
        `\n- Wind: ${wind}${gusts}` +
        `\n- Sky: ${cloud}` +
        `\n- Precipitation: ${rainChance}${thunderChance}${qpf}`;
    } else if (weatherResult.isFailure() && weatherResult.getMessage() !== "User weather not found.") {
      // If the weather is still not set by here. Means that the user has no location set.
      // Hence, don't throw error unless its something else other than no user location set.
      throw new Error(`handleText could not getWeather due to other reasons: ${weatherResult.getMessage()}`);
    }

    return weatherQuery;
  }

  private async getOrCreateVertexSession(mobile_no: string): Promise<string> {
    return (
      this.userVertexSession[mobile_no] ??
      (await (async () => {
        const createVertexSessionResult: Result<VertexSessionInfoData> = await vertexService.createVertexSession();
        if (createVertexSessionResult.isSuccess()) {
          const vertexSession: VertexSessionInfoData = createVertexSessionResult.getData();
          this.userVertexSession[mobile_no] = vertexSession.session;
          return vertexSession.session;
        }
        throw new Error("handleText failed to create vertex session.");
      })())
    );
  }
}

export default new ChatService();
