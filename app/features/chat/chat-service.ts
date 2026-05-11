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
  TimelineSolution,
  ChatHistory,
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
import { Document, ImageRun, Packer, Paragraph, HeadingLevel, BorderStyle, TextRun } from "docx";
import { protos } from "@google-cloud/speech";
import { firebaseConfig, speechConfig } from "../../config/config";
import { SpeechClient } from "@google-cloud/speech/build/src/v2";
import { GoogleError } from "google-gax";

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
  private speechClient: SpeechClient;

  constructor() {
    this.speechClient = new SpeechClient({
      apiEndpoint: speechConfig.API_ENDPOINT,
    });
  }

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
          You are PadiPro, an AI assistant specialized in providing advice and solutions to farmers regarding rice paddy diseases.
          Based on the chat history, you are to return the following based on what the user is currently asking for:

          1. vertexOutput: Whether the user's current query requires you to look up information from Vertex.
            - This field may be set to false if the user's query is simple or does not relate to paddy plant diseases, else true

          2. prompt: If vertexOutput is true, you are to generate a contextualized query to send into Vertex to retrieve relevant information to answer the user's query.
            - You should only include information that is relevant to the user's current query and avoid including irrelevant information that may be in the chat history.

          3. message: The reply you will give back to the user.
            - This can be a simple acknowledgement that you are retrieving information.
            - Do not include any information in the message that should be sent into Vertex, the message is solely for the user and should not include any technical details about the backend processes.
            - Reply explicity in the language the user is using, do not reply in English if the user is using BM and vice versa.
          
          4. language: The language in which the reply should be generated based on the query.
            - This field will be used to ensure the reply is generated in the correct language.

          Here are a few examples
          1. User: What causes leaf blast?
              - vertexOutput: true
              - prompt: What causes leaf blast in rice paddies?
              - message: Let me look that up for you.
              - language: en

          2. User: Do you like ice cream?
              - vertexOutput: false
              - prompt: (not generated since vertexOutput is false)
              - message: Yes, but let's stick to paddy plant diseases, I appreciate your enthusiasm though!
              - language: en

          3. User: How do I treat leaft blast?
              - vertexOutput: true
              - prompt: Provide a timelined treatment plan for leaf blast in rice paddies, return the answer explicity in JSON format.
              - message: Let me find that information for you, stay tuned!
              - language: en
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
    this.messages = [];

    let chatInput: ChatInput = {
      mobile_no: "",
      created_by: "BASE",
      media_type: "text"
    };

    let profileName: string = "";

    // Extract data according to source
    if (this.isWhatsappInput(input)) {
      const rawMsg = input.messages?.[0];
      const contact = input.contacts?.[0];
      const meta = input.metadata;


      if (contact && contact.wa_id) {
        const message = whatsappService.parse(rawMsg!, contact, meta);
        const whatsappMessageFormatted = await whatsappService.handle(message);
        chatInput = whatsappMessageFormatted;
        profileName = contact.profile.name;

      } else {
        throw new Error("Whatsapp contact not found.");
      }
    } else if (this.isWebchatInput(input)) {
      chatInput = {
        ...input,
        created_by: "WEBCHAT",
      };
    } else {
      chatInput = input;
    }

    try {
      // Deconstruct variables for easier access
      let { mobile_no, created_by, message } = chatInput;

      let newUser: boolean = false;
      let userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

      if (userResult.isFailure()) {
        userResult = await userService.createUser(mobile_no, profileName);
        newUser = true;
      }

      // Default lang value.
      let lang: string = "EN";


      if (userResult.isSuccess()) {
        const user: UserData = userResult.getData();
        const locationExist: boolean = !!user.coords;
        if (newUser) {
          await whatsappService.sendIntroductionMessage(mobile_no);
        }
        if (chatInput.media_type !== "location" && !locationExist) {
          await whatsappService.sendLocationInstructionMessage(user.mobile_no);
          return Result.fail(ENUM_STATUS_CODES_FAILURE.FORBIDDEN, "Please set your location.");
        }
        
        lang = (created_by === "WHATSAPP" ? user.lang_whatsapp : user.lang_webchat) || lang;
      }

      if (this.isWhatsappInput(input)) {
        if (chatInput.media_type === "location") {
          const userResult: Result<UserData> = await this.handleLocation(mobile_no, chatInput.latitude, chatInput.longitutde);
          if (userResult.isFailure()) {
            throw new Error("chat failed to set user's location.");
          } else {
            await this.sendText(mobile_no, chatInput.created_by, userResult.getMessage());
            return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, { messages: this.messages }, userResult.getMessage());
          }
        }
      }






      // Transcribe audio to text before saving into chat history for easier tracking
      if (chatInput.media_type === "audio" && chatInput.media_url) {
        const transcribeAudioResult = await this.transcribeAudio(mobile_no, chatInput.media_name, created_by, lang);
        if (transcribeAudioResult.isSuccess()) {
          message = transcribeAudioResult.getData();
        } else if (transcribeAudioResult.isFailure()) {
          await this.sendText(mobile_no, created_by, transcribeAudioResult.getMessage());
          return transcribeAudioResult;
        }
      }

      // Save user message into chat history
      const chatData: ChatHistory = {
        role: "user",
        timestamp: "",
        message: message ?? "",
      };
      if (chatInput.media_type !== "text" && chatInput.media_type !== "location") {
        chatData.media_type = chatInput.media_type;
        chatData.media_url = chatInput.media_url;
        chatData.media_name = chatInput.media_name;
      }
      const saveChatHistoryResult = await chatRepository.saveChatHistory(mobile_no, created_by, chatData);
      if (!saveChatHistoryResult) {
        throw Error(`Failed to save chat history.`);
      }

      // Send thinking message to Whatsapp
      if (created_by === "WHATSAPP") {
        let thinkingMessage = "";
        if (lang === "BM") {
          thinkingMessage = "Beri saya seketika untuk memproses mesej anda";
        } else {
          thinkingMessage = "Give me a moment to process your message...";
        }
        await this.sendText(mobile_no, created_by, thinkingMessage, false);
      }

      // Send media Gemini 3.0 for image diagnosis first if media_url exists
      if (chatInput.media_type === "image" || chatInput.media_type === "video") {
        const mediaResult: Result<string> = await this.updateMediaDiagnosis(chatInput.media_name, lang);
        if (mediaResult.isSuccess()) {
          await this.sendText(mobile_no, created_by, mediaResult.getData());
        } else if (mediaResult.isFailure()) {
          await this.sendText(mobile_no, created_by, mediaResult.getMessage());
          return mediaResult;
        }
      }


      // Send text directly into Gemini 3.1 for chat response generation
      if (message) {
        const textResult: Result<string> = await this.handleText(mobile_no, created_by, chatInput);
        if (textResult.isFailure()) {
          await this.sendText(mobile_no, created_by, textResult.getMessage());
          return textResult;
        }
      }
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, { messages: this.messages }, "Chat response generated.");
    } catch (error) {
      this.sendText(chatInput.mobile_no, chatInput.created_by, "We seem to be having some issues, please try again in an hour or so.");
      throw error;
    }
  }

  // Handling text and audio messages post transcription
  private async handleText(mobile_no: string, type: string, chatInput: ChatInput): Promise<Result<string>> {

    return Result.fail(ENUM_STATUS_CODES_FAILURE.BAD_REQUEST, "I'm just going to fail.");
    // // Send the text into the Gemini chatbot
    // const output = await this.chatFlow(chatInput);
    // if (!output?.reply) {
    //   throw Error(`AI failed to generate a reply.`);
    // }

    // // Get response from Gemini chatbot
    // const { vertexOutput, prompt, reply, language } = output;

    // // Update user language after processing
    // const updateUserLangResult: Result<UserData> = await userService.updateUserLangByMobileNo(
    //   language,
    //   mobile_no,
    //   type,
    // );
    // if (updateUserLangResult.isFailure()) {
    //   throw new Error(`Failed to update user language for mobile_no: ${mobile_no}`);
    // }

    // // Run Vertex Search if Gemini 3.1 thinks we need it
    // if (vertexOutput && prompt && prompt !== "") {
    //   const needSolution: boolean = prompt.toUpperCase().includes("JSON");

    //   // Get weather query via Google Weather API
    //   await this.syncUserWeather(mobile_no);
    //   const weatherQuery: string = await this.generateWeatherQuery(mobile_no, language);

    //   // Start Vertex
    //   const session: string = await this.getOrCreateVertexSession(mobile_no);
    //   const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(
    //     prompt + weatherQuery,
    //     session,
    //   );
    //   const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();

    //   if (
    //     sendQueryVertex.answer.answerText ===
    //     "A summary could not be generated for your search query. Here are some search results."
    //   ) {
    //     let noResultsErrorMessage = "";
    //     if (language === "BM") {
    //       noResultsErrorMessage =
    //         "Maaf, saya tidak dapat menemukan informasi terkait pertanyaan Anda. Bisakah Anda memberikan lebih banyak detail atau mengubah pertanyaan Anda agar saya dapat membantu Anda dengan lebih baik?";
    //     } else {
    //       noResultsErrorMessage =
    //         "Sorry, I couldn't find any information related to your question. Can you provide more details or change your question so I may better assist you?";
    //     }
    //     await this.sendText(mobile_no, type, noResultsErrorMessage);
    //   } else {
    //     if (needSolution) {
    //       await this.sendDocument(mobile_no, type, sendQueryVertex.answer.answerText);
    //     } else {
    //       await this.sendText(mobile_no, type, sendQueryVertex.answer.answerText);
    //     }
    //   }
    // } else {
    //   // Send base message if no Vertex required
    //   await this.sendText(mobile_no, type, reply);
    // }
    // return Result.succeed(
    //   ENUM_STATUS_CODES_SUCCESS.OK,
    //   "Vertex successfully analyzed text and provided solution",
    //   "handleText success.",
    // );
  }

  // Diagnose diseases from images or videos uploaded
  private async updateMediaDiagnosis(mediaName: string, lang: string): Promise<Result<string>> {
    const mediaResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(mediaName);
    if (mediaResult.isFailure()) {
      throw new Error(`updateMediaDiagnosis failed to retrieve media: ${mediaResult.getMessage()}`);
    }
    const media: MediaData = mediaResult.getData();

    const geminiMediaResult: Result<MediaOutput> = await geminiService.media(media.download_url);
    if (geminiMediaResult.isFailure()) {
      // High demand usage of Gemini for image diagnosis
      if (
        geminiMediaResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE &&
        geminiMediaResult.getMessage() ===
        "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
      ) {
        let highDemandErrorMessage = "";
        if (lang === "BM") {
          highDemandErrorMessage = "Kami sedang menghadapi permintaan tinggi, sila cuba lagi kemudian.";
        } else {
          highDemandErrorMessage = "We are currently experiencing high demand, please try again later.";
        }
        return Result.fail(ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE, highDemandErrorMessage);
      }

      // Users spamming too many images
      else if (
        geminiMediaResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS &&
        geminiMediaResult.getMessage() === "Resource has been exhausted (e.g. check quota)."
      ) {
        let tooManyRequestsErrorMessage = "";
        if (lang === "BM") {
          tooManyRequestsErrorMessage = "Anda menghantar mesej terlalu kerap, sila hantar semula dalam 1 minit.";
        } else {
          tooManyRequestsErrorMessage = "You are sending messages too frequently, please send again in 1 minute.";
        }
        return Result.fail(ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS, tooManyRequestsErrorMessage);
      }
      throw Error(
        `updateMediaDiagnosis error, gemini error code ${geminiMediaResult.getStatusCode()}: ${geminiMediaResult.getMessage()}`,
      );
    }

    const mediaOutput: MediaOutput = geminiMediaResult.getData();

    // No detections
    if (mediaOutput.detections[0]?.disease === "NOT DETECTED") {
      let noDetectionMessage = "";
      if (lang === "BM") {
        noDetectionMessage =
          "Maaf, kami tidak dapat mengesan sebarang tanaman padi dalam imej atau video yang anda hantar, sila cuba lagi.";
      } else {
        noDetectionMessage =
          "Sorry, we could not detect any paddy plants in the image or video you sent, please try again.";
      }
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, noDetectionMessage, "handleImage success.");
    }

    // Healthy paddy plant detected
    else if (mediaOutput.detections[0]?.disease === "HEALTHY") {
      const media: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(
        mediaName,
        mediaOutput.detections,
      );
      if (media.isFailure()) {
        throw new Error(`updateMediaDiagnosis failed to update media diagnosis: ${media.getMessage()}`);
      }

      let healthyMessage = "";
      if (lang === "BM") {
        healthyMessage =
          "Imej atau video yang anda hantar menunjukkan tanaman padi yang sihat tanpa tanda-tanda penyakit. Teruskan usaha menjaga tanaman padi anda!";
      } else {
        healthyMessage =
          "The image you sent shows healthy paddy plants without any signs of disease. Keep up the good work in caring for your paddy plants!";
      }
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, healthyMessage, "handleImage success.");
    }

    // Disease(s) detected
    else {
      const media: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(
        mediaName,
        mediaOutput.detections,
      );
      if (media.isFailure() || !mediaOutput.detections[0]) {
        throw new Error(`updateMediaDiagnosis failed to update media diagnosis: ${media.getMessage()}`);
      }

      let diseaseNames: string = "";
      const detections = mediaOutput.detections;

      if (detections.length <= 1) {
        diseaseNames = detections[0] ? detections[0].disease : "";
      } else {
        diseaseNames =
          detections
            .slice(0, -1)
            .map((d) => d.disease)
            .join(", ") +
          ", and " +
          detections.at(-1)!.disease;
      }

      let diseaseMessage = "";
      if (lang === "BM") {
        diseaseMessage = `Imej atau video yang anda hantar telah dianalisis dan menunjukkan tanda-tanda ${diseaseNames}. Saya sedang menyusun pelan rawatan untuk anda sekarang.`;
      } else {
        diseaseMessage = `The image you sent has been analyzed and shows signs of ${diseaseNames}. I am putting together a treatment plan for you now.`;
      }
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, diseaseMessage, "updateMediaDiagnosis success.");
    }
  }

  // Transcribe audio files
  public async transcribeAudio(
    mobile_no: string,
    mediaName: string,
    type: string,
    lang: string,
  ): Promise<Result<string>> {
    const userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);
    if (userResult.isFailure()) {
      throw new Error("transcribeAudio couldn't find user.");
    }

    const audioResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(mediaName);
    if (audioResult.isFailure()) {
      throw new Error("transcribeAudio couldn't find audio.");
    }

    const audio: MediaData = audioResult.getData();

    const request: protos.google.cloud.speech.v2.IRecognizeRequest = {
      recognizer: `projects/${speechConfig.SPEECH_PROJECT}/locations/${speechConfig.REGION}/recognizers/_`,
      config: {
        autoDecodingConfig: {},
        languageCodes: ["ms-MY", "cmn-Hans-CN"],
        model: "chirp_3",
      },
      uri: `${firebaseConfig.BUCKET}/${audio.storage_path}`,
    };

    try {
      const [response] = await this.speechClient.recognize(request);

      const transcript: string | undefined = response.results
        ?.map((r) => r.alternatives?.[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (!transcript) {
        let noAudioErrorMessage = "";
        if (lang === "BM") {
          noAudioErrorMessage = "Maaf, kami tidak dapat mendeteksi ucapan apa pun dalam audio Anda, silakan coba lagi.";
        } else {
          noAudioErrorMessage = "Sorry, we could not detect any speech in your audio, please try again.";
        }
        return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, noAudioErrorMessage);
      }

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, transcript, "transcribeAudio success.");
    } catch (error) {
      if (error instanceof GoogleError) {
        if (error.code === 3) {
          let message = "";
          if (lang === "BM") {
            message =
              "Maaf, audio Anda terlalu panjang (maksimal 60 detik). Silakan kirim pesan suara yang lebih pendek.";
          } else {
            message = "Your audio is too long (max 60 seconds). Please send a shorter voice message.";
          }
          await this.sendText(mobile_no, type, message);
        }
      }
      throw Error("transcribeAudio failed to transcribe.", { cause: error });
    }
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

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, user.getData(), "Location successfully set.");
  }

  // Handling document
  private async handleDocument(mobile_no: string, type: string, flowOutput: ChatFlowOutput): Promise<Result<string>> {
    const { vertexOutput, prompt, reply, language } = flowOutput;

    // Send the base message generated from Gemini 3.1 first
    await this.sendText(mobile_no, type, reply);

    // Run Vertex Search if Gemini 3.1 thinks we need it
    if (vertexOutput && prompt && prompt !== "") {
      // Get weather query via Google Weather API
      await this.syncUserWeather(mobile_no);
      const weatherQuery: string = await this.generateWeatherQuery(mobile_no, language);

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
        await this.sendDocument(mobile_no, type, sendQueryVertex.answer.answerText);
      }
    }
    return Result.succeed(
      ENUM_STATUS_CODES_SUCCESS.OK,
      "Vertex successfully analyzed text and provided solution",
      "handleDocument success.",
    );
  }

  // Validate if the input is from Whatsapp
  private isWhatsappInput(input: any): input is WhatsappRawValue {
    return input && typeof input === "object" && "messaging_product" in input;
  }

  // Validate if the input is from Sky's frontend webchat
  private isWebchatInput(input: any): input is WhatsappRawValue {
    return input && typeof input === "object" && "messaging_product" in input;
  }

  private async sendText(
    mobile_no: string,
    type: string,
    message: string,
    saveToHistory: boolean = true,
  ): Promise<void> {
    if (saveToHistory) {
      const saveChatHistoryResult = await chatRepository.saveChatHistory(mobile_no, type.toLowerCase(), {
        role: "model",
        timestamp: "",
        message: message ?? "",
      });
      if (!saveChatHistoryResult) {
        throw Error(`sendText failed to save chat history.`);
      }
    }

    if (type.toUpperCase() === "WHATSAPP") {
      whatsappService.sendText(mobile_no, message);
    } else {
      this.messages.push({
        message: message,
        type: "text",
      });
    }
  }

  private async sendMedia(
    mobile_no: string,
    type: string,
    message: string,
    base64URL: string,
    mediaType: string,
  ): Promise<void> {
    const saveChatHistoryResult = await chatRepository.saveChatHistory(mobile_no, type.toLowerCase(), {
      role: "model",
      timestamp: "",
      message: message ?? "",
    });
    if (!saveChatHistoryResult) {
      throw Error(`sendMedia failed to save chat history.`);
    }

    if (type.toUpperCase() === "WHATSAPP") {
      if (mediaType === "image") {
        const buffer = Buffer.from(base64URL, "base64");
        const mediaId = await whatsappService.uploadMedia(buffer, {
          filename: "image.png",
          mimeType: "image/png",
        });
        await whatsappService.sendImage(mobile_no, { mediaId }, message);
      } else {
        await whatsappService.sendVideo(mobile_no, { link: base64URL }, message);
      }
    }

    this.messages.push({
      message: message,
      type: "text",
    });
  }

  private async sendDocument(mobile_no: string, type: string, message: string): Promise<void> {
    const cleaned = this.cleanPrefix(message);
    const json = JSON.parse(cleaned);
    const saveChatHistoryResult = await chatRepository.saveChatHistory(mobile_no, type.toLowerCase(), {
      role: "user",
      timestamp: "",
      message: message ?? "",
    });
    if (!saveChatHistoryResult) {
      throw Error(`Failed to save chat history.`);
    }

    if (type.toUpperCase() === "WHATSAPP") {
      const doc = await this.generateDocuments(json);

      //im keeping this at whatsappService cause it's exclusive to whatsapp
      const mediaId = await whatsappService.uploadMedia(doc, {
        filename: "timeline.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const saveDocumentResult: Result<MediaData> = await mediaService.saveDocument(
        mediaId,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        doc,
        mobile_no,
      );
      console.log(`[Whatsapp] Saved document to Firestore and Storage`);

      if (saveDocumentResult.isFailure()) {
        throw new Error(`handleText failed to saveDocument: ${saveDocumentResult.getMessage()}`);
      }

      await whatsappService.sendDocument(mobile_no, { mediaId: mediaId });
    }

    this.messages.push({
      message: json,
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

  private async generateWeatherQuery(mobile_no: string, lang: string): Promise<string> {
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

      if (lang === "BM") {
        weatherQuery =
          "\nSelain itu, berikut adalah kondisi cuaca saat ini yang dapat Anda referensikan saat menyesuaikan rencana solusi yang dipersonalisasi: " +
          `\nKondisi cuaca saat ini:` +
          `\n- Kondisi: ${condition}` +
          `\n- Suhu: ${temp}, ${feelsLike}, ${humidity}` +
          `\n- Angin: ${wind}${gusts}` +
          `\n- Langit: ${cloud}` +
          `\n- Presipitasi: ${rainChance}${thunderChance}${qpf}`;
      } else {
        weatherQuery =
          "\nAdditionally, here are the current weather conditions that you may reference when tailoring the personalized solution plan: " +
          `\nCurrent weather conditions:` +
          `\n- Condition: ${condition}` +
          `\n- Temperature: ${temp}, ${feelsLike}, ${humidity}` +
          `\n- Wind: ${wind}${gusts}` +
          `\n- Sky: ${cloud}` +
          `\n- Precipitation: ${rainChance}${thunderChance}${qpf}`;
      }
    } else if (weatherResult.isFailure() && weatherResult.getMessage() !== "User weather not found.") {
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

  private cleanInternalTag(str: string): string {
    return str.replace(/\[\.\.\.]\(asc_slot:\/\/[^)]+\)/g, "").trim();
  }

  private cleanPrefix(input: string): string {
    const cleaned = input
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const start = cleaned.indexOf("[");

    if (start === -1) {
      throw new Error("No JSON array found");
    }

    let bracketCount = 0;

    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "[") bracketCount++;
      if (cleaned[i] === "]") bracketCount--;

      if (bracketCount === 0) {
        return cleaned.slice(start, i + 1);
      }
    }

    throw new Error("Incomplete JSON array");
  }

  private cleanTimeline(timeline: TimelineSolution[]): TimelineSolution[] {
    return timeline.map((item) => ({
      day: this.cleanInternalTag(item.day ?? ""),
      solution: this.cleanInternalTag(item.solution ?? ""),
      description: this.cleanInternalTag(item.description ?? ""),
    }));
  }

  private buildChildren(timeline: TimelineSolution[], base64URL?: string): Paragraph[] {
    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Timeline for Solution", bold: true })],
        spacing: { after: 320 },
      }),
      ...(base64URL
        ? [
          new Paragraph({
            children: [
              new ImageRun({
                data: Uint8Array.from(atob(base64URL), (c) => c.charCodeAt(0)),
                transformation: {
                  width: 200,
                  height: 100,
                },
                type: "jpg",
              }),
            ],
          }),
        ]
        : []),
    );

    // Group entries by day label, preserving insertion order
    const groups = new Map<string, TimelineSolution[]>();
    for (const item of timeline) {
      if (!groups.has(item.day)) groups.set(item.day, []);
      groups.get(item.day)!.push(item);
    }

    for (const [day, entries] of groups) {
      // Day heading
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: day, bold: true })],
          spacing: { before: 360, after: 120 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 4,
              color: "2E75B6",
              space: 1,
            },
          },
        }),
      );

      entries.forEach((entry, i) => {
        // Step number + solution
        children.push(
          new Paragraph({
            spacing: { before: 160, after: 60 },
            children: [
              new TextRun({
                text: `Step ${i + 1}: `,
                bold: true,
                size: 24,
                color: "2E75B6",
              }),
              new TextRun({ text: entry.solution, size: 24 }),
            ],
          }),
        );

        // Description — indented, italic
        children.push(
          new Paragraph({
            spacing: { before: 0, after: 160 },
            indent: { left: 480 },
            children: [
              new TextRun({
                text: "→ ",
                bold: true,
                color: "888888",
                size: 22,
              }),
              new TextRun({
                text: entry.description,
                italics: true,
                color: "555555",
                size: 22,
              }),
            ],
          }),
        );
      });
    }

    return children;
  }

  public async generateDocuments(timeline: TimelineSolution[], base64URL?: string): Promise<Buffer> {
    const clean = this.cleanTimeline(timeline);
    const children = this.buildChildren(clean, base64URL);

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Arial", size: 24 } },
        },
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { size: 36, bold: true, font: "Arial", color: "1F3864" },
            paragraph: {
              spacing: { before: 0, after: 240 },
              outlineLevel: 0,
            },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
            paragraph: {
              spacing: { before: 240, after: 120 },
              outlineLevel: 1,
            },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }
}

export default new ChatService();
