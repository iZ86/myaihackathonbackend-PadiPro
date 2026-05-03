
import { Result } from '../../../libs/Result';
import { ENUM_STATUS_CODES_SUCCESS, ENUM_STATUS_CODES_FAILURE } from '../../../libs/status-codes-enum';
import { ImageOutput, ImageOutputDetection } from '../gemini/gemini-model';
import geminiService from '../gemini/gemini-service';
import { UserData } from '../user/user-model';
import userService from '../user/user-service';
import { VertexAnswerQueryData, VertexSessionInfoData } from '../vertex/vertex-model';
import vertexService from '../vertex/vertex-service';
import { WeatherData } from '../weather/weather-model';
import weatherService from '../weather/weather-service';
import {
  WhatsappMessage, ITextMessage, IImageMessage, IAudioMessage, IVideoMessage, ILocationMessage,
  RawMessage, RawContact, RawMetadata,
  SendTextPayload, SendImagePayload, SendAudioPayload, SendVideoPayload, SendReplyResponse,
  WhatsappImageData,
} from './whatsapp-model';
import whatsappRepository from './whatsapp-repository';
import whatsappConverter from './whatsapp-converter';

// Testing to hold vertex sessions
const userVertexSession: { [mobile_no: string]: string } = {};

//downloading img sent by user and saved into buffer
export class MediaService {
  async fetch(mediaId: string, url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}` },
    });
    if (!response.ok) throw new Error(`Media fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

//sending text to user
export class ReplyService {
  private readonly baseUrl = 'https://graph.facebook.com';
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v25.0';

  private get endpoint(): string {
    return `${this.baseUrl}/${this.apiVersion}/${process.env.PHONE_NUMBER_ID}/messages`;
  }

  private async post(payload: SendTextPayload | SendImagePayload | SendAudioPayload | SendVideoPayload): Promise<SendReplyResponse> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Reply failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<SendReplyResponse>;
  }

  async sendText(
    to: string,
    body: string,
    previewUrl: boolean = false
  ): Promise<SendReplyResponse> {
    const payload: SendTextPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body, preview_url: previewUrl },
    };
    return this.post(payload);
  }

  async sendImage(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
    caption?: string,
  ): Promise<SendReplyResponse> {
    const image = 'mediaId' in source && source.mediaId
      ? { id: source.mediaId, ...(caption ? { caption } : {}) }
      : { link: source.link!, ...(caption ? { caption } : {}) };

    const payload: SendImagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image,
    };
    return this.post(payload);
  }

  async sendAudio(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
  ): Promise<SendReplyResponse> {
    const audio = 'mediaId' in source && source.mediaId
      ? { id: source.mediaId }
      : { link: source.link! };

    const payload: SendAudioPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'audio',
      audio,
    };
    return this.post(payload);
  }

  async sendVideo(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
    caption?: string,
  ): Promise<SendReplyResponse> {
    const video = 'mediaId' in source && source.mediaId
      ? { id: source.mediaId, ...(caption ? { caption } : {}) }
      : { link: source.link!, ...(caption ? { caption } : {}) };

    const payload: SendVideoPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'video',
      video,
    };
    return this.post(payload);
  }
}

//parsing msg 
export class WhatsappService {
  private readonly media: MediaService;
  private readonly reply: ReplyService;

  constructor() {
    this.media = new MediaService();
    this.reply = new ReplyService();
  }

  parse(
    rawMsg: RawMessage,
    contact: RawContact | undefined,
    meta: RawMetadata | undefined,
  ): WhatsappMessage {
    const base = {
      from: rawMsg.from,
      messageId: rawMsg.id,
      timestamp: rawMsg.timestamp,
      name: contact?.profile?.name,
      waId: contact?.wa_id,
      phoneNumberId: meta?.phone_number_id,
    };

    switch (rawMsg.type) {
      case 'text':
        return { ...base, type: 'text', body: rawMsg.text?.body } satisfies ITextMessage;

      case 'image':
        return {
          ...base,
          type: 'image',
          mediaId: rawMsg.image?.id,
          url: rawMsg.image?.url,
          caption: rawMsg.image?.caption,
          mimeType: rawMsg.image?.mime_type,
          sha256: rawMsg.image?.sha256,
        } satisfies IImageMessage;

      case 'audio':
        return {
          ...base,
          type: 'audio',
          mediaId: rawMsg.audio?.id,
          url: rawMsg.audio?.url,
          mimeType: rawMsg.audio?.mime_type,
          voice: rawMsg.audio?.voice,
          sha256: rawMsg.audio?.sha256,
        } satisfies IAudioMessage;

      case 'video':
        return {
          ...base,
          type: 'video',
          mediaId: rawMsg.video?.id,
          url: rawMsg.video?.url,
          mimeType: rawMsg.video?.mime_type,
          sha256: rawMsg.video?.sha256,
        } satisfies IVideoMessage;

      case 'location':
        return {
          ...base,
          type: 'location',
          latitude: rawMsg.location?.latitude,
          longitude: rawMsg.location?.longitude,
          locName: rawMsg.location?.name,
          address: rawMsg.location?.address,
        } satisfies ILocationMessage;

      default:
        throw new Error(`Unsupported message type: ${(rawMsg as RawMessage).type}`);
    }
  }


  async handle(message: WhatsappMessage, user: UserData, newUser: boolean, hasLocation: boolean): Promise<void> {
    //im directly calling this send text here to make sure we can send out this msg even if the first msg the user sents out is any media
    if (newUser) {
      await this.sendIntroductionMessage(message)
    }
    if (message.type != 'location' && !hasLocation) {
      await this.sendLocationInstructionMessage(user.mobile_no)
      return;
    }

    switch (message.type) {
      case 'text': return this.handleText(message, user);
      case 'image': return this.handleImage(message, user);
      case 'audio': return this.handleAudio(message, user);
      case 'video': return this.handleVideo(message, user);
      case 'location': return this.handleLocation(message, user);
    }
  }

  // This only works if the user has coords.
  async myHandleText(msg: string, user: UserData, newUser: boolean): Promise<void> {

    if (newUser) {
      console.log(
        `
            Welcome to PadiPro! 🌾💪 

            I'm a quick diagnostics tool that offers you guidance on what issues your paddy plants may be facing, and how to solve them!

            You may respond by:

            1. Uploading an image for us to diagnose and provide you with the recommended solution(s) 🌾 📸 
            2. Ask questions regarding rice plant diseases commonly found in Malaysia ❓ 💬 
            3. Send us your live location for us to determine the local weather and climate in future diagnostics 🌥️ 🌧️ 

            I'm able to respond to both text and image messages, now let's get started! 
        `
      )
      return;
    }

    const mobile_no: string = user.mobile_no;

    await this.syncUserWeather(mobile_no);

    let weatherQuery: string = await this.generateWeatherQuery(mobile_no);

    const session: string = await this.getOrCreateVertexSession(mobile_no);

    console.log(`[text] from ${user.mobile_no}: ${msg + weatherQuery}`);
    const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(msg + weatherQuery, session);

    const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
    if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
      console.log(`[reply sent] message id: I specialize in rice paddy disease analysis. Could you clarify how your question relates to crop health?`);
    } else {
      console.log(`[reply sent] message id: ${sendQueryVertex.answer.answerText}`);
    }
  }

  // This only works if the user has coords.
  // Also doesn't save image.
  async myHandleImage(image_url: string, user: UserData, newUser: boolean): Promise<void> {

    if (newUser) {
      console.log(
        `
            Welcome to PadiPro! 🌾💪 

            I'm a quick diagnostics tool that offers you guidance on what issues your paddy plants may be facing, and how to solve them!

            You may respond by:

            1. Uploading an image for us to diagnose and provide you with the recommended solution(s) 🌾 📸 
            2. Ask questions regarding rice plant diseases commonly found in Malaysia ❓ 💬 
            3. Send us your live location for us to determine the local weather and climate in future diagnostics 🌥️ 🌧️ 

            I'm able to respond to both text and image messages, now let's get started! 
        `
      )
      return;
    }

    const imageResult: Result<ImageOutput> = await geminiService.image(image_url);
    if (imageResult.isFailure()) {
      throw new Error("myHandleImage geminiService.image failed to detect image.");
    }

    const imageOutput: ImageOutput = imageResult.getData();

    if (imageOutput.detections[0]?.disease === "NOT DETECTED") {
      console.log(`[reply sent] message id: I couldn’t detect any rice paddies in this image. Please upload an image that clearly shows a rice field for analysis.`);
      return;
    } else if (imageOutput.detections[0]?.disease === "HEALTHY") {
      console.log(`[reply sent] message id: No visible signs of disease detected. The rice plants appear healthy based on this image.`);
      return;
    } else {

      const mobile_no: string = user.mobile_no;

      await this.syncUserWeather(mobile_no);

      const weatherQuery: string = await this.generateWeatherQuery(mobile_no);

      const session: string = await this.getOrCreateVertexSession(mobile_no);

      const defaultQuery: string = `What causes ${imageOutput.detections[0]?.disease}, and how to solve it? `;
      console.log(`[text] from ${user.mobile_no}: ${defaultQuery + weatherQuery}`);
      const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(defaultQuery + weatherQuery, session);

      const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
      if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
        console.log(`[reply sent] message id: I’m not confident in identifying this condition based on my current knowledge. Please consult an agricultural expert or provide more details.`);
      } else {
        console.log(`[reply sent] message id: ${sendQueryVertex.answer.answerText}`);
      }
    }
  }

  private async handleText(msg: ITextMessage, user: UserData): Promise<void> {
    try {
      const mobile_no: string = user.mobile_no;

      await this.syncUserWeather(mobile_no);

      const weatherQuery: string = await this.generateWeatherQuery(mobile_no);

      if (!msg.body) {
        throw new Error("handleText does not have message.body");
      }

      const session: string = await this.getOrCreateVertexSession(mobile_no);


      const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(msg.body + weatherQuery, session);


      const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
      if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
        await this.reply.sendText(msg.from, "I specialize in rice paddy disease analysis. Could you clarify how your question relates to crop health?")
      } else {
        await this.reply.sendText(msg.from, sendQueryVertex.answer.answerText);
      }

    } catch (error) {
      await this.reply.sendText(msg.from, "We seem to be having some issues, please try again in an hour or so.");
      throw error;
    }
  }

  private async syncUserWeather(mobile_no: string): Promise<undefined> {

    const getWeatherResult: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobile_no);

    if (getWeatherResult.isSuccess()) {

      const updateWeatherResult: Result<WeatherData> = await weatherService.updateWeather(mobile_no);

      if (updateWeatherResult.isFailure() &&
        ((updateWeatherResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.NOT_FOUND && updateWeatherResult.getMessage() !== "User location is not set.") ||
          (updateWeatherResult.getStatusCode() !== ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS))) {

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
      const thunderChance = (weather.thunderstormProbability ? weather.thunderstormProbability > 0 : false) ? `, ${weather.thunderstormProbability}% chance of thunderstorms` : "";
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
    return userVertexSession[mobile_no] ?? await (async () => {
      const createVertexSessionResult: Result<VertexSessionInfoData> = await vertexService.createVertexSession();
      if (createVertexSessionResult.isSuccess()) {
        const vertexSession: VertexSessionInfoData = createVertexSessionResult.getData();
        userVertexSession[mobile_no] = vertexSession.session;
        return vertexSession.session;
      }
      throw new Error("handleText failed to create vertex session.");
    })();
  }

  private async handleImage(msg: IImageMessage, user: UserData): Promise<void> {
    try {
      if (msg.mediaId && msg.url) {
        console.log(`[Whatsapp] Detected message as: Image`);
        
        const buffer = await this.media.fetch(msg.mediaId, msg.url);
        console.log(`[Whatsapp] Fetched image buffer from Whatsapp`);

        const saveImageResult: boolean = await whatsappRepository.saveImage(msg.from, buffer, {
          mediaId: msg.mediaId,
          mimeType: msg.mimeType ?? 'image/jpeg',
          ...(msg.caption && { caption: msg.caption }),
          ...(msg.sha256 && { sha256: msg.sha256 }),
        });
        console.log(`[Whatsapp] Saved image to Firestore and Storage`);

        if (!saveImageResult) {
          throw new Error("handleImage failed to saveImage");
        }

        const imageResult: Result<WhatsappImageData> = await this.getImageByMediaId(msg.mediaId);
        if (imageResult.isFailure()) {
          throw new Error("handleImage failed to retrieve image.");
        }

        const image: WhatsappImageData = imageResult.getData();

        const geminiImageResult: Result<ImageOutput> = await geminiService.image(image.download_url);
        if (geminiImageResult.isFailure()) {

          const deleteImageResult: Result<null> = await this.deleteImageByMediaId(msg.mediaId);
          if (deleteImageResult.isFailure()) {
            throw new Error("handleImage delete image failed.");
          }

          if (geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE && geminiImageResult.getMessage() === "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.") {
            await this.reply.sendText(msg.from, "We are currently experiencing high demand, please try again later.");
            return;
          } else if (geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS && geminiImageResult.getMessage() === "Resource has been exhausted (e.g. check quota).") {
            await this.reply.sendText(msg.from, "You are sending images too frequently, please send again in 1 minute.");
            return;
          }
          throw Error(`handleImage error, gemini error code ${geminiImageResult.getStatusCode()}: ${geminiImageResult.getMessage()}`);
        }

        const imageOutput: ImageOutput = geminiImageResult.getData();

        if (imageOutput.detections[0]?.disease === "NOT DETECTED") {

          const deleteImageResult: Result<null> = await this.deleteImageByMediaId(msg.mediaId);
          if (deleteImageResult.isFailure()) {
            throw new Error("handleImage delete image failed.");
          }
          await this.reply.sendText(msg.from, "I couldn’t detect any rice paddies in this image. Please upload an image that clearly shows a rice field for analysis.");
          return;

        } else if (imageOutput.detections[0]?.disease === "HEALTHY") {

          await whatsappRepository.updateImageDiagnosis(msg.mediaId, imageOutput.detections);

          await this.reply.sendText(msg.from, "No visible signs of disease detected. The rice plants appear healthy based on this image.");
          return;

        } else {

          await whatsappRepository.updateImageDiagnosis(msg.mediaId, imageOutput.detections);

          const mobile_no: string = user.mobile_no;

          console.log(`[Whatsapp] Syncing weather status`);
          await this.syncUserWeather(mobile_no);
          console.log(`[Whatsapp] Weather status synced`);

          const weatherQuery: string = await this.generateWeatherQuery(mobile_no);

          console.log(`[Vertex] Creating session`);
          const session: string = await this.getOrCreateVertexSession(mobile_no);
          console.log(`[Vertex] Session created`);

          const defaultQuery: string = `What causes ${imageOutput.detections[0]?.disease}? Generate a 7-day plan to solve it in a farm. `;

          console.log(`[Vertex] Sending response to Vertex`);
          const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(defaultQuery + weatherQuery, session);
          console.log(`[Vertex] Response received`);

          const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
          if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
            await this.reply.sendText(msg.from, "I’m not confident in identifying this condition based on my current knowledge. Please provide more details.");
          } else {

            // Generate sendText response
            await this.reply.sendText(msg.from, sendQueryVertex.answer.answerText);

            // Generate sendImage response

            // Generate sendDocument response
          }
        }
      }
    } catch (error) {
      await this.reply.sendText(msg.from, "We seem to be having some issues, please try again in an hour or so.");
      throw error;
    }
  }

  private async handleAudio(msg: IAudioMessage, user: UserData): Promise<void> {
    if (msg.mediaId && msg.url) {
      const buffer     = await this.media.fetch(msg.mediaId, msg.url);
      const transcript = await whatsappConverter.convertAndTranscribe(buffer);
      
      if (transcript) {
        await this.reply.sendText(msg.from, `You said: "${transcript}"`);
      }
    }
  }

  private async handleVideo(msg: IVideoMessage, user: UserData): Promise<void> {
    await this.reply.sendText(msg.from, "Sorry, I can’t process audio or video messages. Please send your question as text or an image.");
  }

  private async handleLocation(msg: ILocationMessage, user: UserData): Promise<void> {

    try {
      if (!msg.longitude || !msg.latitude) {
        throw new Error("handleLocation undefined longitude or latitude");
      }

      const userResult: Result<UserData> = await userService.updateUserCoordsByMobileNo(msg.latitude, msg.longitude, user.mobile_no);
      if (userResult.isFailure()) {
        throw new Error(`handleLocation failed to updateUserCoords ${userResult.getMessage()}`);
      }

      await this.reply.sendText(msg.from, "Location updated successfully.");

    } catch (error) {
      await this.reply.sendText(msg.from, "We seem to be having some issues, please try again in an hour or so.");
      throw error;
    }



  }

  public async getImagesbyMobileNo(mobile_no: string): Promise<Result<WhatsappImageData[]>> {
    const images: WhatsappImageData[] = await whatsappRepository.getImagesByMobileNo(mobile_no);

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, images, "Diagnosis history successfully retrieved.");
  }

  private async sendIntroductionMessage(message: WhatsappMessage) {
    await this.reply.sendText(
      message.from,
      `
          Welcome to PadiPro! 🌾💪 
          \nI'm a quick diagnostics tool that offers you guidance on what issues your paddy plants may be facing, and how to solve them!
          \nYou may respond by:
          \n1. Uploading an image for us to diagnose and provide you with the recommended solution(s) 🌾 📸 
          \n2. Ask questions regarding rice plant diseases commonly found in Malaysia ❓ 💬 
          \n3. Send us your live location for us to determine the local weather and climate in future diagnostics 🌥️ 🌧️ 
          \nI'm able to respond to both text and image messages, now let's get started!
        `
    )
    return;
  }

  private async sendLocationInstructionMessage(to: string): Promise<void> {
    const images = await whatsappRepository.getLocationTutorialImages();
    if (!images) {
      console.warn('[sendLocationInstruction] no tutorial images found');
      return;
    }
    await this.reply.sendText(to, "Before we start, please set up your location by following the steps below:");
    await this.reply.sendImage(to, { link: images.step_1 }, 'Step 1');
    await this.reply.sendImage(to, { link: images.step_2 }, 'Step 2');
    await this.reply.sendImage(to, { link: images.step_3 }, 'Step 3');
  }

  private async getImageByMediaId(mediaId: string): Promise<Result<WhatsappImageData>> {
    const image: WhatsappImageData | undefined = await whatsappRepository.getImageByMediaId(mediaId);
    if (!image) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "Image not found.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, image, "Image found.");
  }

  private async deleteImageByMediaId(mediaId: string): Promise<Result<null>> {
    const imageResult: Result<WhatsappImageData> = await this.getImageByMediaId(mediaId);
    if (imageResult.isFailure()) {
      return imageResult;
    }

    const deleteImageResult: boolean = await whatsappRepository.deleteImageByMediaId(mediaId);
    if (!deleteImageResult) {
      throw new Error("deleteImageByMediaId failed to delete");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.NO_CONTENT, null, "Image successfully deleted.");
  }

  public async sendOTP(to: string, otp: string): Promise<void> {
    await this.reply.sendText(to, `Your One-Time Password (OTP) is ${otp}. Valid for 5 minutes.`);
  }
}

export default new WhatsappService();
