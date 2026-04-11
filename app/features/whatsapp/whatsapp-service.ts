// ============================================================
// services/whatsapp.service.ts
// MessageService (parsing + dispatch) + MediaService + ReplyService
// ============================================================

import {
  WhatsappMessage,
  TextMessage,
  ImageMessage,
  AudioMessage,
  VideoMessage,
  LocationMessage,
  RawMessage,
  RawContact,
  RawMetadata,
} from './whatsapp-model';

// ------------------------------------------------------------
// MediaService — download media files from the Cloud API
// ------------------------------------------------------------
export class MediaService {
  async fetch(mediaId: string, url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    });

    if (!response.ok) throw new Error(`Media fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

// ------------------------------------------------------------
// ReplyService — send outbound messages via the Cloud API
// ------------------------------------------------------------
export class ReplyService {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  async sendText(to: string, body: string): Promise<void> {
    const url = `${this.baseUrl}/${process.env.PHONE_NUMBER_ID}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    if (!res.ok) throw new Error(`Reply failed: ${await res.text()}`);
  }
}

// ------------------------------------------------------------
// MessageService — parse raw webhook payload → typed model,
//                  then dispatch to the right handler
// ------------------------------------------------------------
export class MessageService {
  private readonly media: MediaService;
  private readonly reply: ReplyService;

  constructor() {
    this.media = new MediaService();
    this.reply = new ReplyService();
  }

  // --- Parsing (previously MessageParser) -------------------

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

  // --- Dispatch ---------------------------------------------

  async handle(message: WhatsappMessage): Promise<void> {
    switch (message.type) {
      case 'text':     return this.handleText(message);
      case 'image':    return this.handleImage(message);
      case 'audio':    return this.handleAudio(message);
      case 'video':    return this.handleVideo(message);
      case 'location': return this.handleLocation(message);
    }
  }

  // --- Handlers ---------------------------------------------

  private async handleText(msg:TextMessage): Promise<void> {
    console.log(`[text] from ${msg.name}: ${msg.body}`);
    await this.reply.sendText(msg.from, `You said: ${msg.body}`);
  }

  private async handleImage(msg: ImageMessage): Promise<void> {
    console.log(`[image] from ${msg.name}, caption: ${msg.caption}`);
    if (msg.mediaId && msg.url) {
      const file = await this.media.fetch(msg.mediaId, msg.url);
      // process file buffer...
    }
  }

  private async handleAudio(msg: AudioMessage): Promise<void> {
    console.log(`[audio] from ${msg.name}, voice note: ${msg.voice}`);
    if (msg.mediaId && msg.url) {
      const file = await this.media.fetch(msg.mediaId, msg.url);
      // transcribe or store...
    }
  }

  private async handleVideo(msg: VideoMessage): Promise<void> {
    console.log(`[video] from ${msg.name}`);
    if (msg.mediaId && msg.url) {
      const file = await this.media.fetch(msg.mediaId, msg.url);
      // process...
    }
  }

  private async handleLocation(msg: LocationMessage): Promise<void> {
    console.log(`[location] from ${msg.name}: ${msg.latitude}, ${msg.longitude}`);
    // reverse geocode, store, etc.
  }
}