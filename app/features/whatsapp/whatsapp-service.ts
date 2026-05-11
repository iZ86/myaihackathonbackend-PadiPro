import { Result } from "../../../libs/Result";
import { UserData } from "../user/user-model";
import {
  WhatsappMessage,
  ITextMessage,
  IImageMessage,
  IAudioMessage,
  IVideoMessage,
  ILocationMessage,
  RawMessage,
  RawContact,
  RawMetadata,
  SendTextPayload,
  SendImagePayload,
  SendAudioPayload,
  SendVideoPayload,
  SendDocPayload,
  SendReplyResponse,
  OTPData,
  OTPExpiresAtData,
} from "./whatsapp-model";
import { LocationTutorialImages, MediaData } from "../media/media-model";
import mediaService from "../media/media-service";
import { ChatInput } from "../chat/chat-model";
import chatService from "../chat/chat-service";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import whatsappRepository from "./whatsapp-repository";
import userService from "../user/user-service";
import { whatsappConfig } from "../../config/config";

export class WhatsappService {
  private readonly baseUrl = "https://graph.facebook.com";
  private readonly apiVersion = whatsappConfig.API_VERSION ?? "v25.0";
  //downloading img sent by user and saved into buffer
  async fetch(mediaId: string, url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${whatsappConfig.API_KEY}` },
    });
    if (!response.ok) throw new Error(`Media fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  // Parse raw message form Whatsapp to reusable format (WhatsappMessage)
  parse(rawMsg: RawMessage, contact: RawContact, meta: RawMetadata): WhatsappMessage {
    const base = {
      from: rawMsg.from,
      messageId: rawMsg.id,
      timestamp: rawMsg.timestamp,
      name: contact.profile.name,
      waId: contact.wa_id,
      phoneNumberId: meta?.phone_number_id,
    };

    switch (rawMsg.type) {
      case "text":
        return {
          ...base,
          type: "text",
          body: rawMsg.text?.body,
        } satisfies ITextMessage;

      case "image":
        return {
          ...base,
          type: "image",
          mediaId: rawMsg.image?.id,
          url: rawMsg.image?.url,
          caption: rawMsg.image?.caption,
          mimeType: rawMsg.image?.mime_type,
          sha256: rawMsg.image?.sha256,
        } satisfies IImageMessage;

      case "audio":
        return {
          ...base,
          type: "audio",
          mediaId: rawMsg.audio?.id,
          url: rawMsg.audio?.url,
          mimeType: rawMsg.audio?.mime_type,
          voice: rawMsg.audio?.voice,
          sha256: rawMsg.audio?.sha256,
        } satisfies IAudioMessage;

      case "video":
        return {
          ...base,
          type: "video",
          mediaId: rawMsg.video?.id,
          url: rawMsg.video?.url,
          mimeType: rawMsg.video?.mime_type,
          sha256: rawMsg.video?.sha256,
        } satisfies IVideoMessage;

      case "location":
        return {
          ...base,
          type: "location",
          latitude: rawMsg.location?.latitude,
          longitude: rawMsg.location?.longitude,
          locName: rawMsg.location?.name,
          address: rawMsg.location?.address,
        } satisfies ILocationMessage;

      default:
        throw new Error(`Unsupported message type: ${(rawMsg as RawMessage).type}`);
    }
  }

  // Send message base function
  private get endpoint(): string {
    return `${this.baseUrl}/${this.apiVersion}/${whatsappConfig.PHONE_NUMBER_ID}/messages`;
  }
  private async post(
    payload: SendTextPayload | SendImagePayload | SendAudioPayload | SendVideoPayload | SendDocPayload,
  ): Promise<SendReplyResponse> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${whatsappConfig.API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Reply failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<SendReplyResponse>;
  }

  async uploadMedia(buffer: Buffer, options?: { filename?: string; mimeType?: string }): Promise<string> {
    const url = `${this.baseUrl}/${this.apiVersion}/${whatsappConfig.PHONE_NUMBER_ID}/media`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], {
      type: options?.mimeType ?? "application/octet-stream",
    });
    formData.append("file", blob, options?.filename ?? "upload");
    formData.append("messaging_product", "whatsapp");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappConfig.API_KEY}`,
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async sendText(to: string, body: string, previewUrl: boolean = false): Promise<SendReplyResponse> {
    const payload: SendTextPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body, preview_url: previewUrl },
    };
    return this.post(payload);
  }

  async sendImage(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
    caption?: string,
  ): Promise<SendReplyResponse> {
    const image =
      "mediaId" in source && source.mediaId
        ? { id: source.mediaId, ...(caption ? { caption } : {}) }
        : { link: source.link!, ...(caption ? { caption } : {}) };

    const payload: SendImagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image,
    };
    return this.post(payload);
  }

  async sendAudio(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
  ): Promise<SendReplyResponse> {
    const audio = "mediaId" in source && source.mediaId ? { id: source.mediaId } : { link: source.link! };

    const payload: SendAudioPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "audio",
      audio,
    };
    return this.post(payload);
  }

  async sendVideo(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
    caption?: string,
  ): Promise<SendReplyResponse> {
    const video =
      "mediaId" in source && source.mediaId
        ? { id: source.mediaId, ...(caption ? { caption } : {}) }
        : { link: source.link!, ...(caption ? { caption } : {}) };

    const payload: SendVideoPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "video",
      video,
    };
    return this.post(payload);
  }

  async sendDocument(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
    options?: { caption?: string; filename?: string },
  ): Promise<SendReplyResponse> {
    const document =
      "mediaId" in source && source.mediaId
        ? {
          id: source.mediaId,
          ...(options?.caption ? { caption: options.caption } : {}),
          ...(options?.filename ? { filename: options.filename } : {}),
        }
        : {
          link: source.link!,
          ...(options?.caption ? { caption: options.caption } : {}),
          ...(options?.filename ? { filename: options.filename } : {}),
        };
    const payload: SendDocPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document,
    };
    return this.post(payload);
  }

  async handle(
    message: WhatsappMessage
  ): Promise<ChatInput | void> {

    switch (message.type) {
      case "text":
        return await this.handleText(message);
      case "image":
        return await this.handleImage(message);
      case "audio":
        return await this.handleAudio(message);
      case "video":
        return await this.handleVideo(message);
      case "location":
        return await this.handleLocation(message);
    }
  }

  private async handleText(msg: ITextMessage): Promise<ChatInput | void> {
    if (!msg.body) {
      throw new Error("handleText does not have message.body");
    }

    return {
      mobile_no: msg.waId,
      created_by: "WHATSAPP",
      message: msg.body,
      media_type: "text"
    };
  }

  private async handleImage(msg: IImageMessage): Promise<ChatInput | void> {
    if (msg.mediaId && msg.url) {
      console.log(`[Whatsapp] Detected message as: Image`);

      const buffer = await this.fetch(msg.mediaId, msg.url);
      console.log(`[Whatsapp] Fetched image buffer from Whatsapp`);

      const saveImageResult: Result<MediaData> = await mediaService.saveImage(
        msg.mediaId,
        msg.mimeType ?? "image/jpeg",
        buffer,
        msg.waId,
        msg.caption,
        msg.sha256,
      );
      console.log(`[Whatsapp] Saved image to Firestore and Storage`);
      if (saveImageResult.isFailure()) {
        throw new Error(`handleImage failed to saveImage: ${saveImageResult.getMessage()}`);
      }

      const savedImage: MediaData = saveImageResult.getData();
      const imageResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(savedImage.mediaName);
      if (imageResult.isFailure()) {
        throw new Error("handleImage failed to retrieve image.");
      }

      const image: MediaData = imageResult.getData();
      return {
        mobile_no: msg.waId,
        created_by: "WHATSAPP",
        message: msg.caption,
        media_type: "image",
        media_url: image.download_url,
        media_name: image.mediaName,
      };
    }
  }

  private async handleAudio(msg: IAudioMessage): Promise<ChatInput | void> {
    if (!msg.mediaId || !msg.url) {
      throw new Error("handleAudio URL invalid.");
    }

    console.log(`[Whatsapp] Detected message as: Audio`);

    const buffer = await this.fetch(msg.mediaId, msg.url);
    console.log(`[Whatsapp] Fetched audio buffer from Whatsapp`);

    const saveAudioResult: Result<MediaData> = await mediaService.saveAudio(
      msg.mediaId,
      msg.mimeType ?? "audio/ogg",
      buffer,
      msg.waId,
      undefined,
      msg.sha256,
    );
    if (saveAudioResult.isFailure()) {
      throw new Error(`handleAudio failed to saveAudio: ${saveAudioResult.getMessage()}`);
    }
    console.log(`[Whatsapp] Saved audio to Firestore and Storage`);

    const savedAudio: MediaData = saveAudioResult.getData();
    const audioResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(savedAudio.mediaName);
    if (audioResult.isFailure()) {
      throw new Error("handleAudio failed to retrieve audio.");
    }

    const audio: MediaData = audioResult.getData();
    return {
      mobile_no: msg.waId,
      created_by: "WHATSAPP",
      media_type: "audio",
      media_url: audio.download_url,
      media_name: savedAudio.mediaName,
    };
  }

  private async handleVideo(msg: IVideoMessage): Promise<ChatInput | void> {
    if (msg.mediaId && msg.url) {
      console.log(`[Whatsapp] Detected message as: Video`);

      const buffer = await this.fetch(msg.mediaId, msg.url);
      console.log(`[Whatsapp] Fetched video buffer from Whatsapp`);

      const saveVideoResult: Result<MediaData> = await mediaService.saveVideo(
        msg.mediaId,
        msg.mimeType ?? "video/mp4",
        buffer,
        msg.waId,
        undefined,
        msg.sha256,
      );

      if (saveVideoResult.isFailure()) {
        throw new Error(`handleVideo failed to saveVideo: ${saveVideoResult.getMessage()}`);
      }
      console.log(`[Whatsapp] Saved video to Firestore and Storage`);

      const savedVideo: MediaData = saveVideoResult.getData();
      const videoResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(savedVideo.mediaName);
      if (videoResult.isFailure()) {
        throw new Error("handleVideo failed to retrieve video.");
      }

      const video: MediaData = videoResult.getData();
      return {
        mobile_no: msg.waId,
        created_by: "WHATSAPP",
        media_type: "video",
        media_url: video.download_url,
        media_name: savedVideo.mediaName,
      };
    }
  }

  private async handleLocation(msg: ILocationMessage): Promise<ChatInput> {
    if (!msg.longitude || !msg.latitude) {
      throw new Error("handleLocation undefined longitude or latitude");
    }

    return {
      mobile_no: msg.waId,
      created_by: "WHATSAPP",
      media_type: "location",
      longitutde: msg.longitude,
      latitude: msg.latitude
    }
  }

  public async sendIntroductionMessage(mobile_no: string) {
    await this.sendText(
      mobile_no,
      `
            Welcome to PadiPro! 🌾💪
            \nI'm a quick diagnostics tool that offers you guidance on what issues your paddy plants may be facing, and how to solve them!
            \nYou may respond by:
            \n1. Uploading an image for us to diagnose and provide you with the recommended solution(s) 🌾 📸
            \n2. Ask questions regarding rice plant diseases commonly found in Malaysia ❓ 💬
            \n3. Send us your live location for us to determine the local weather and climate in future diagnostics 🌥️ 🌧️
            \nI'm able to respond to both text and image messages, now let's get started!
            `,
    );
    return;
  }

  private async sendLocationInstructionMessage(to: string): Promise<void> {
    const locationTutorialImagesResult: Result<LocationTutorialImages> = await mediaService.getLocationTutorialImages();
    if (locationTutorialImagesResult.isFailure()) {
      throw new Error(`sendLocationInstructionMessage error ${locationTutorialImagesResult.getMessage()}`);
    }

    const locationTutorialImages: LocationTutorialImages = locationTutorialImagesResult.getData();
    await this.sendText(to, "Before we start, please set up your location by following the steps below:");
    await this.sendImage(to, { link: locationTutorialImages.step_1 }, "Step 1");
    await this.sendImage(to, { link: locationTutorialImages.step_2 }, "Step 2");
    await this.sendImage(to, { link: locationTutorialImages.step_3 }, "Step 3");
  }

  public async generateOTP(mobile_no: string): Promise<Result<OTPExpiresAtData>> {
    const userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

    if (userResult.isFailure()) {
      return userResult;
    }

    const otp: string = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const saveOTPResult: boolean = await whatsappRepository.saveOTP(mobile_no, otp, expiresAt);
    if (!saveOTPResult) {
      throw new Error("OTP failed to be saved.");
    }

    const generatedOTPResult: Result<OTPData> = await this.getOTPByMobileNo(mobile_no);
    if (generatedOTPResult.isFailure()) {
      throw new Error("generateOTP failed to get generated OTP.");
    }

    const generatedOTP: OTPData = generatedOTPResult.getData();

    await this.sendText(mobile_no, `Your One-Time Password (OTP) is ${otp}. Valid for 5 minutes.`);

    const otpExpiresAt: OTPExpiresAtData = {
      expires_at: generatedOTP.expires_at,
    };

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, otpExpiresAt, `OTP has been sent to ${mobile_no}.`);
  }

  private async getOTPByMobileNo(mobile_no: string): Promise<Result<OTPData>> {
    const userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

    if (userResult.isFailure()) {
      return userResult;
    }

    const otp: OTPData | undefined = await whatsappRepository.getOTPByMobileNo(mobile_no);
    if (!otp) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "OTP not found.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, otp, "OTP retrieved.");
  }

  public async verifyOTP(mobile_no: string, otp: string): Promise<Result<null>> {
    const userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

    if (userResult.isFailure()) {
      return userResult;
    }

    const otpResult: Result<OTPData> = await this.getOTPByMobileNo(mobile_no);

    if (otpResult.isFailure()) {
      return otpResult;
    }

    const otpData: OTPData = otpResult.getData();

    if (new Date(otpData.expires_at) < new Date()) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.FORBIDDEN, "Invalid OTP.");
    }

    if (otpData.otp !== otp) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.FORBIDDEN, "Invalid OTP.");
    }

    const deleteOTPResult: boolean = await whatsappRepository.deleteOTPByMobileNo(mobile_no);
    if (!deleteOTPResult) {
      throw new Error("verifyOTP failed to delete OTP.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, null, "OTP verified successfully.");
  }
}

export default new WhatsappService();
