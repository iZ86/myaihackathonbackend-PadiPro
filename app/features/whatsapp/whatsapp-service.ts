import { Result } from '../../../libs/Result';
import { ENUM_STATUS_CODES_FAILURE } from '../../../libs/status-codes-enum';
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
} from './whatsapp-model';
import whatsappRepository from './whatsapp-repository';

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

  async handle(message: WhatsappMessage, user: UserData): Promise<void> {

    switch (message.type) {
      case 'text': return this.handleText(message, user);
      case 'image': return this.handleImage(message, user);
      case 'audio': return this.handleAudio(message, user);
      case 'video': return this.handleVideo(message, user);
      case 'location': return this.handleLocation(message, user);
    }
  }

  async myHandleText(msg: string, user: UserData): Promise<void> {


    const mobile_no: string = user.mobile_no;

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
        "\nAdditionally, here are teh current weather conditions that yo may reference: " +
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


    const session = userVertexSession[mobile_no] ?? await (async () => {
      const createVertexSessionResult: Result<VertexSessionInfoData> = await vertexService.createVertexSession();
      if (createVertexSessionResult.isSuccess()) {
        const vertexSession: VertexSessionInfoData = createVertexSessionResult.getData();
        userVertexSession[mobile_no] = vertexSession.session;
        return vertexSession.session;
      }
      throw new Error("handleText failed to create vertex session.");
    })();

    console.log(`[text] from ${user.mobile_no}: ${msg + weatherQuery}`);
    const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(msg + weatherQuery, session);

    const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
    if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
      console.log("I specialize in rice paddy disease analysis. Could you clarify how your question relates to crop health?");

    } else {
      console.log(sendQueryVertex.answer.answerText);
      console.log(`[reply sent] message id: ${sendQueryVertex.answer.answerText}`);
    }
  }

  private async handleText(msg: ITextMessage, user: UserData): Promise<void> {

    const mobile_no: string = user.mobile_no;

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
        "\nAdditionally, here are the current weather conditions that you may reference: " +
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

    if (!msg.body) {
      throw new Error("handleText does not have message.body");
    }

    const session = userVertexSession[mobile_no] ?? await (async () => {
      const createVertexSessionResult: Result<VertexSessionInfoData> = await vertexService.createVertexSession();
      if (createVertexSessionResult.isSuccess()) {
        const vertexSession: VertexSessionInfoData = createVertexSessionResult.getData();
        userVertexSession[mobile_no] = vertexSession.session;
        return vertexSession.session;
      }
      throw new Error("handleText failed to create vertex session.");
    })();


    const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(msg.body + weatherQuery, session);


    const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
    if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
      await this.reply.sendText(msg.from, "I specialize in rice paddy disease analysis. Could you clarify how your question relates to crop health?")

    } else {
      await this.reply.sendText(msg.from, sendQueryVertex.answer.answerText);
    }
  }

  private async handleImage(msg: IImageMessage, user: UserData): Promise<void> {
    // console.log(`[image] from ${msg.name}, caption: ${msg.caption}`);

    if (msg.mediaId && msg.url) {
      const buffer = await this.media.fetch(msg.mediaId, msg.url);

      await whatsappRepository.saveImage(msg.from, buffer, {
        mediaId: msg.mediaId,
        mimeType: msg.mimeType ?? 'image/jpeg',
        ...(msg.caption && { caption: msg.caption }),
        ...(msg.sha256 && { sha256: msg.sha256 }),
      });

      const result = await this.reply.sendImage(msg.from, { mediaId: msg.mediaId }, msg.caption);
      // console.log(`[image echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleAudio(msg: IAudioMessage, user: UserData): Promise<void> {
    // console.log(`[audio] from ${msg.name}, voice note: ${msg.voice}`);
    if (msg.mediaId) {
      const result = await this.reply.sendAudio(msg.from, { mediaId: msg.mediaId });
      // console.log(`[audio echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleVideo(msg: IVideoMessage, user: UserData): Promise<void> {
    // console.log(`[video] from ${msg.name}`);
    if (msg.mediaId) {
      const result = await this.reply.sendVideo(msg.from, { mediaId: msg.mediaId });
      // console.log(`[video echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleLocation(msg: ILocationMessage, user: UserData): Promise<void> {
    // console.log(`[location] from ${msg.name}: ${msg.latitude}, ${msg.longitude}`);
    //business logic

    if (!msg.longitude || !msg.latitude) {
      throw new Error("handleLocation undefined longitude or latitude");
    }

    const userResult: Result<UserData> = await userService.updateUserCoordsByMobileNo(msg.latitude, msg.longitude, user.mobile_no);
    if (userResult.isFailure()) {
      throw new Error(`handleLocation failed to updateUserCoords ${userResult.getMessage()}`);
    }

    this.reply.sendText(msg.from, "Location updated successfully.");


  }
}

export default new WhatsappService();
