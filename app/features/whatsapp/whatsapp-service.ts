
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
import mainService from '../main/main-service';
import { MediaData } from '../media/media-model';
import mediaService from '../media/media-service';

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

    try {
      switch (message.type) {
        case 'text': return this.handleText(message, user);
        case 'image': return this.handleImage(message, user);
        case 'audio': return this.handleAudio(message, user);
        case 'video': return this.handleVideo(message, user);
        case 'location': return this.handleLocation(message, user);
      }
    } catch (error) {
      await this.reply.sendText(message.from, "We seem to be having some issues, please try again in an hour or so.");
      throw error;
    }
  }

  private async handleText(msg: ITextMessage, user: UserData): Promise<void> {

    if (!msg.body) {
      throw new Error("handleText does not have message.body");
    }

    const handleTextResult: Result<string> = await mainService.handleText(user.mobile_no, msg.body);

    if (handleTextResult.isSuccess()) {
      const replyText: string = handleTextResult.getData();
      await this.reply.sendText(msg.from, replyText);
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
    if (msg.mediaId && msg.url) {
      console.log(`[Whatsapp] Detected message as: Image`);

      const buffer = await this.media.fetch(msg.mediaId, msg.url);
      console.log(`[Whatsapp] Fetched image buffer from Whatsapp`);

      const saveImageResult: Result<MediaData> = await mediaService.saveImage(msg.mediaId, msg.mimeType ?? 'image/jpeg', buffer, user.mobile_no, msg.caption, msg.sha256);
      console.log(`[Whatsapp] Saved image to Firestore and Storage`);

      if (saveImageResult.isFailure()) {
        throw new Error(`handleImage failed to saveImage: ${saveImageResult.getMessage()}`);
      }

      const saveImage: MediaData = saveImageResult.getData();

      const handleImageResult: Result<string> = await mainService.handleImage(user.mobile_no, saveImage.mediaName);
      if (handleImageResult.isSuccess()) {
        await this.reply.sendText(msg.from, handleImageResult.getData());
      } else if (handleImageResult.isFailure()) {
        await this.reply.sendText(msg.from, handleImageResult.getMessage());
      }
    }
  }

  private async handleAudio(msg: IAudioMessage, user: UserData): Promise<void> {
    if (msg.mediaId && msg.url) {
      const buffer = await this.media.fetch(msg.mediaId, msg.url);
      const transcript = await whatsappConverter.convertAndTranscribe(buffer);
      console.log(transcript.success);

      if (transcript.success) {
        const textMsg: ITextMessage = {
          ...msg,
          type: 'text',
          body: transcript.text,
        };
        this.handleText(textMsg, user);
      } else {
        this.reply.sendText(msg.from, transcript.text);
      }
    }
  }

  private async handleVideo(msg: IVideoMessage, user: UserData): Promise<void> {

    if (msg.mediaId && msg.url) {
      console.log(`[Whatsapp] Detected message as: Video`);

      const buffer = await this.media.fetch(msg.mediaId, msg.url);
      console.log(`[Whatsapp] Fetched image buffer from Whatsapp`);

      const saveVideoResult: Result<MediaData> = await mediaService.saveVideo(msg.mediaId, msg.mimeType ?? 'video/mp4', buffer, user.mobile_no, undefined, msg.sha256);
      console.log(`[Whatsapp] Saved video to Firestore and Storage`);

      if (saveVideoResult.isFailure()) {
        throw new Error(`handleImage failed to saveImage: ${saveVideoResult.getMessage()}`);
      }

      const savedVideo: MediaData = saveVideoResult.getData();


      const handleVideoResult: Result<string> = await mainService.handleVideo(user.mobile_no, savedVideo.mediaName);
      if (handleVideoResult.isSuccess()) {
        await this.reply.sendText(msg.from, handleVideoResult.getData());
      } else if (handleVideoResult.isFailure()) {
        await this.reply.sendText(msg.from, handleVideoResult.getMessage());
      }
    }

  }

  private async handleLocation(msg: ILocationMessage, user: UserData): Promise<void> {

    if (!msg.longitude || !msg.latitude) {
      throw new Error("handleLocation undefined longitude or latitude");
    }

    const handleLocationResult: Result<UserData> = await mainService.handleLocation(user.mobile_no, msg.latitude, msg.longitude);

    if (handleLocationResult.isFailure()) {

      throw new Error(`handleLocation failed to updateUserCoords ${handleLocationResult.getMessage()}`);
    } else if (handleLocationResult.isSuccess()) {

      await this.reply.sendText(msg.from, "Location updated successfully.");
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
