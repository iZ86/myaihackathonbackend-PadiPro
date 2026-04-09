import {
  WhatsappMessage, ITextMessage, IImageMessage, IAudioMessage, IVideoMessage, ILocationMessage,
  RawMessage, RawContact, RawMetadata,
  SendTextPayload, SendImagePayload, SendAudioPayload, SendVideoPayload, SendReplyResponse,
} from './whatsapp-model';
import whatsappRepository from './whatsapp-repository';

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
  private readonly baseUrl    = 'https://graph.facebook.com';
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v25.0';

  private get endpoint(): string {
    return `${this.baseUrl}/${this.apiVersion}/${process.env.PHONE_NUMBER_ID}/messages`;
  }

  private async post(payload: SendTextPayload | SendImagePayload | SendAudioPayload | SendVideoPayload): Promise<SendReplyResponse> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
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
      recipient_type:    'individual',
      to,
      type: 'text',
      text: { body, preview_url: previewUrl },
    };
    return this.post(payload);
  }

  async sendImage(
    to:       string,
    source:   { mediaId: string; link?: never } | { link: string; mediaId?: never },
    caption?: string,
  ): Promise<SendReplyResponse> {
    const image = 'mediaId' in source && source.mediaId
      ? { id: source.mediaId, ...(caption ? { caption } : {}) }
      : { link: source.link!,  ...(caption ? { caption } : {}) };

    const payload: SendImagePayload = {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'image',
      image,
    };
    return this.post(payload);
  }

  async sendAudio(
    to:     string,
    source: { mediaId: string; link?: never } | { link: string; mediaId?: never },
  ): Promise<SendReplyResponse> {
    const audio = 'mediaId' in source && source.mediaId
      ? { id: source.mediaId }
      : { link: source.link! };

    const payload: SendAudioPayload = {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'audio',
      audio,
    };
    return this.post(payload);
  }

  async sendVideo(
    to:       string,
    source:   { mediaId: string; link?: never } | { link: string; mediaId?: never },
    caption?: string,
  ): Promise<SendReplyResponse> {
    const video = 'mediaId' in source && source.mediaId
      ? { id: source.mediaId, ...(caption ? { caption } : {}) }
      : { link: source.link!,  ...(caption ? { caption } : {}) };

    const payload: SendVideoPayload = {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'video',
      video,
    };
    return this.post(payload);
  }
}

//parsing msg 
export class MessageService {
  private readonly media: MediaService;
  private readonly reply: ReplyService;

  constructor() {
    this.media = new MediaService();
    this.reply = new ReplyService();
  }

  parse(
    rawMsg:  RawMessage,
    contact: RawContact | undefined,
    meta:    RawMetadata | undefined,
  ): WhatsappMessage {
    const base = {
      from:          rawMsg.from,
      messageId:     rawMsg.id,
      timestamp:     rawMsg.timestamp,
      name:          contact?.profile?.name,
      waId:          contact?.wa_id,
      phoneNumberId: meta?.phone_number_id,
    };

    switch (rawMsg.type) {
      case 'text':
        return { ...base, type: 'text', body: rawMsg.text?.body } satisfies ITextMessage;

      case 'image':
        return {
          ...base,
          type:     'image',
          mediaId:  rawMsg.image?.id,
          url:      rawMsg.image?.url,
          caption:  rawMsg.image?.caption,
          mimeType: rawMsg.image?.mime_type,
          sha256:   rawMsg.image?.sha256,
        } satisfies IImageMessage;

      case 'audio':
        return {
          ...base,
          type:     'audio',
          mediaId:  rawMsg.audio?.id,
          url:      rawMsg.audio?.url,
          mimeType: rawMsg.audio?.mime_type,
          voice:    rawMsg.audio?.voice,
          sha256:   rawMsg.audio?.sha256,
        } satisfies IAudioMessage;

      case 'video':
        return {
          ...base,
          type:     'video',
          mediaId:  rawMsg.video?.id,
          url:      rawMsg.video?.url,
          mimeType: rawMsg.video?.mime_type,
          sha256:   rawMsg.video?.sha256,
        } satisfies IVideoMessage;

      case 'location':
        return {
          ...base,
          type:      'location',
          latitude:  rawMsg.location?.latitude,
          longitude: rawMsg.location?.longitude,
          locName:   rawMsg.location?.name,
          address:   rawMsg.location?.address,
        } satisfies ILocationMessage;

      default:
        throw new Error(`Unsupported message type: ${(rawMsg as RawMessage).type}`);
    }
  }

  async handle(message: WhatsappMessage): Promise<void> {
    switch (message.type) {
      case 'text':     return this.handleText(message);
      case 'image':    return this.handleImage(message);
      case 'audio':    return this.handleAudio(message);
      case 'video':    return this.handleVideo(message);
      case 'location': return this.handleLocation(message);
    }
  }

  private async handleText(msg: ITextMessage): Promise<void> {
    console.log(`[text] from ${msg.name}: ${msg.body}`);
    const result = await this.reply.sendText(msg.from, `You said: ${msg.body}`);
    console.log(`[reply sent] message id: ${result.messages[0]?.id}`);
  }

  private async handleImage(msg: IImageMessage): Promise<void> {
    console.log(`[image] from ${msg.name}, caption: ${msg.caption}`);

    if (msg.mediaId && msg.url) {
      const buffer = await this.media.fetch(msg.mediaId, msg.url);

      await whatsappRepository.saveImage(msg.from, buffer, {
        mediaId:  msg.mediaId,
        mimeType: msg.mimeType ?? 'image/jpeg',
        ...(msg.caption && { caption: msg.caption }),
        ...(msg.sha256  && { sha256:  msg.sha256  }),
      });

      const result = await this.reply.sendImage(msg.from, { mediaId: msg.mediaId }, msg.caption);
      console.log(`[image echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleAudio(msg: IAudioMessage): Promise<void> {
    console.log(`[audio] from ${msg.name}, voice note: ${msg.voice}`);
    if (msg.mediaId) {
      const result = await this.reply.sendAudio(msg.from, { mediaId: msg.mediaId });
      console.log(`[audio echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleVideo(msg: IVideoMessage): Promise<void> {
    console.log(`[video] from ${msg.name}`);
    if (msg.mediaId) {
      const result = await this.reply.sendVideo(msg.from, { mediaId: msg.mediaId });
      console.log(`[video echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleLocation(msg: ILocationMessage): Promise<void> {
    console.log(`[location] from ${msg.name}: ${msg.latitude}, ${msg.longitude}`);
    //business logic
  }
}