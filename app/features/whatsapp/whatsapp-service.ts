
import { Result } from '../../../libs/Result';
import { UserData } from '../user/user-model';
import {
  WhatsappMessage, ITextMessage, IImageMessage, IAudioMessage, IVideoMessage, ILocationMessage,
  RawMessage, RawContact, RawMetadata,
  SendTextPayload, SendImagePayload, SendAudioPayload, SendVideoPayload, SendDocPayload, SendReplyResponse, Timeline
} from './whatsapp-model';
import whatsappConverter from './whatsapp-converter';
import mainService from '../main/main-service';
import { LocationTutorialImages, MediaData } from '../media/media-model';
import mediaService from '../media/media-service';
import { Document, ImageRun, Packer, Paragraph, HeadingLevel, BorderStyle, TextRun } from "docx";

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

  private async post(payload: SendTextPayload | SendImagePayload | SendAudioPayload | SendVideoPayload | SendDocPayload): Promise<SendReplyResponse> {
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

  async uploadMedia(
    buffer: Buffer,
    options?: { filename?: string; mimeType?: string },
  ): Promise<string> {
    const url = `${this.baseUrl}/${this.apiVersion}/${process.env.PHONE_NUMBER_ID}/media`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: options?.mimeType ?? 'application/octet-stream' });
    formData.append('file', blob, options?.filename ?? 'upload');
    formData.append('messaging_product', 'whatsapp');
 
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}`,
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
 
    const data = await res.json() as { id: string };
    return data.id;
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

  async sendDoc(
    to: string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
    options?: { caption?: string; filename?: string },
  ): Promise<SendReplyResponse> {
    const document =
      'mediaId' in source && source.mediaId
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
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document,
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
    console.log('start handling texzt');

    if (!msg.body) {
      throw new Error("handleText does not have message.body");
    }

    const handleTextResult: Result<string> = await mainService.handleText(user.mobile_no, msg.body);
    console.log('finish querying');

    if (handleTextResult.isSuccess()) {
      // const replyText: string = handleTextResult.getData();
      // await this.reply.sendText(msg.from, replyText);

      const cleaned = this.cleanPrefix(handleTextResult.getData());
      const json = JSON.parse(cleaned);
      const doc = await this.generateDocuments(json);

      const mediaId = await this.reply.uploadMedia(doc, {
        filename: 'timeline.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const saveImageResult: Result<MediaData> = await mediaService.saveDocument(mediaId, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc, msg.from)
      console.log(`[Whatsapp] Saved document to Firestore and Storage`);

      if (saveImageResult.isFailure()) {
        throw new Error(`handleImage failed to saveImage: ${saveImageResult.getMessage()}`);
      }

      await this.reply.sendDoc(msg.from, {mediaId: mediaId});
    }
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
    const locationTutorialImagesResult: Result<LocationTutorialImages> = await mediaService.getLocationTutorialImages();
    if (locationTutorialImagesResult.isFailure()) {
      throw new Error(`sendLocationInstructionMessage error ${locationTutorialImagesResult.getMessage()}`);
    }

    const locationTutorialImages: LocationTutorialImages = locationTutorialImagesResult.getData();
    await this.reply.sendText(to, "Before we start, please set up your location by following the steps below:");
    await this.reply.sendImage(to, { link: locationTutorialImages.step_1 }, 'Step 1');
    await this.reply.sendImage(to, { link: locationTutorialImages.step_2 }, 'Step 2');
    await this.reply.sendImage(to, { link: locationTutorialImages.step_3 }, 'Step 3');
  }

  public async sendOTP(to: string, otp: string): Promise<void> {
    await this.reply.sendText(to, `Your One-Time Password (OTP) is ${otp}. Valid for 5 minutes.`);
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

  private cleanTimeline(timeline: Timeline[]): Timeline[] {
    return timeline.map((item) => ({
      day: this.cleanInternalTag(item.day ?? ""),
      solution: this.cleanInternalTag(item.solution ?? ""),
      description: this.cleanInternalTag(item.description ?? ""),
    }));
  }

  public buildChildren(timeline: Timeline[]): Paragraph[] {
    const children: Paragraph[] = [];
  
    // Title
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({ text: "Timeline for Solution", bold: true }),
        ],
        spacing: { after: 320 },
      })
    );
  
    // Group entries by day label, preserving insertion order
    const groups = new Map<string, Timeline[]>();
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
        })
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
          })
        );
  
        // Description — indented, italic
        children.push(
          new Paragraph({
            spacing: { before: 0, after: 160 },
            indent: { left: 480 },
            children: [
              new TextRun({ text: "→ ", bold: true, color: "888888", size: 22 }),
              new TextRun({
                text: entry.description,
                italics: true,
                color: "555555",
                size: 22,
              }),
            ],
          })
        );
      });
    }
  
    return children;
  }

  public async generateDocuments(
    timeline: Timeline[]
  ): Promise<Buffer> {
    const clean = this.cleanTimeline(timeline);
    const children = this.buildChildren(clean);
  
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



export default new WhatsappService();
