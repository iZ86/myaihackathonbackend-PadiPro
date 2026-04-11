import { WhatsappMessage,TextMessage, ImageMessage, AudioMessage, VideoMessage, LocationMessage, 
         RawMessage, RawContact, RawMetadata, SendTextPayload, SendReplyResponse } from './whatsapp-model';

//download media from Whatsapp Cloud API
export class MediaService {
  async fetch(mediaId: string, url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    });

    if (!response.ok) throw new Error(`Media fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

//currently the token is hardcoded into render server environment
export class ReplyService {
  private readonly baseUrl   = 'https://graph.facebook.com/v25.0';

  private get endpoint(): string {
    return `${this.baseUrl}/${process.env.PHONE_NUMBER_ID}/messages`;
  }

  private async post(payload: SendTextPayload): Promise<SendReplyResponse> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Reply failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<SendReplyResponse>;
  }

  async sendText(
    to:          string,
    body:        string,
    previewUrl:  boolean = true,
  ): Promise<SendReplyResponse> {
    const payload: SendTextPayload = {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'text',
      text: {
        body,
        preview_url: previewUrl,
      },
    };

    return this.post(payload);
  }
}

//parse request and send to respective handler
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
        return {
          ...base,
          type: 'text',
          body: rawMsg.text?.body,
        } satisfies TextMessage;

      case 'image':
        return {
          ...base,
          type:     'image',
          mediaId:  rawMsg.image?.id,
          url:      rawMsg.image?.url,
          caption:  rawMsg.image?.caption,
          mimeType: rawMsg.image?.mime_type,
          sha256:   rawMsg.image?.sha256,
        } satisfies ImageMessage;

      case 'audio':
        return {
          ...base,
          type:     'audio',
          mediaId:  rawMsg.audio?.id,
          url:      rawMsg.audio?.url,
          mimeType: rawMsg.audio?.mime_type,
          voice:    rawMsg.audio?.voice,
          sha256:   rawMsg.audio?.sha256,
        } satisfies AudioMessage;

      case 'video':
        return {
          ...base,
          type:     'video',
          mediaId:  rawMsg.video?.id,
          url:      rawMsg.video?.url,
          mimeType: rawMsg.video?.mime_type,
          sha256:   rawMsg.video?.sha256,
        } satisfies VideoMessage;

      case 'location':
        return {
          ...base,
          type:      'location',
          latitude:  rawMsg.location?.latitude,
          longitude: rawMsg.location?.longitude,
          locName:   rawMsg.location?.name,
          address:   rawMsg.location?.address,
        } satisfies LocationMessage;

      default:
        throw new Error(`Unsupported message type: ${(rawMsg as RawMessage).type}`);
    }
  }

  
  //handler to handle business logic regarding to msg type
  async handle(message: WhatsappMessage): Promise<void> {
    switch (message.type) {
      case 'text':     return this.handleText(message);
      case 'image':    return this.handleImage(message);
      case 'audio':    return this.handleAudio(message);
      case 'video':    return this.handleVideo(message);
      case 'location': return this.handleLocation(message);
    }
  }

  private async handleText(msg: TextMessage): Promise<void> {
    console.log(`[text] from ${msg.name}: ${msg.body}`);
    const result = await this.reply.sendText(msg.from, `You said: ${msg.body}`);
    console.log(`[reply sent] message id: ${result.messages[0]?.id}`);
  }

  private async handleImage(msg: ImageMessage): Promise<void> {
    console.log(`[image] from ${msg.name}, caption: ${msg.caption}`);
    if (msg.mediaId && msg.url) {
      const file = await this.media.fetch(msg.mediaId, msg.url);
      // business logic
    }
  }

  private async handleAudio(msg: AudioMessage): Promise<void> {
    console.log(`[audio] from ${msg.name}, voice note: ${msg.voice}`);
    if (msg.mediaId && msg.url) {
      const file = await this.media.fetch(msg.mediaId, msg.url);
      // business logic
    }
  }

  private async handleVideo(msg: VideoMessage): Promise<void> {
    console.log(`[video] from ${msg.name}`);
    if (msg.mediaId && msg.url) {
      const file = await this.media.fetch(msg.mediaId, msg.url);
      // business logic
    }
  }

  private async handleLocation(msg: LocationMessage): Promise<void> {
    console.log(`[location] from ${msg.name}: ${msg.latitude}, ${msg.longitude}`);
    // business logic
  }
}