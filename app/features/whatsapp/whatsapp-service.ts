import fs   from 'fs';
import path from 'path';
import os   from 'os';

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
  SendReplyResponse,
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
// MediaStore — save media buffers to tmp/, manual cleanup only
// ------------------------------------------------------------
export interface StoredMedia {
  filePath: string;
  mediaId:  string;
  mimeType: string | undefined;
  savedAt:  number;
}

export class MediaStore {
  private readonly tmpDir: string;
  private readonly index = new Map<string, StoredMedia>();

  constructor(
    tmpDir: string = path.join(os.tmpdir(), 'whatsapp-media'),
  ) {
    this.tmpDir = tmpDir;
    fs.mkdirSync(this.tmpDir, { recursive: true });
    console.log(`[MediaStore] storing files in: ${this.tmpDir}`);
  }

  async save(
    mediaId:  string,
    buffer:   Buffer,
    mimeType: string | undefined,
  ): Promise<StoredMedia> {
    const ext      = this.extFromMime(mimeType);
    const fileName = `${mediaId}${ext}`;
    const filePath = path.join(this.tmpDir, fileName);

    await fs.promises.writeFile(filePath, buffer);

    const entry: StoredMedia = { filePath, mediaId, mimeType, savedAt: Date.now() };
    this.index.set(mediaId, entry);
    console.log(`[MediaStore] saved → ${filePath}`);
    return entry;
  }

  get(mediaId: string): StoredMedia | undefined {
    return this.index.get(mediaId);
  }

  async read(mediaId: string): Promise<Buffer | undefined> {
    const entry = this.index.get(mediaId);
    if (!entry) return undefined;
    try {
      return await fs.promises.readFile(entry.filePath);
    } catch {
      return undefined;
    }
  }

  async delete(mediaId: string): Promise<void> {
    const entry = this.index.get(mediaId);
    if (!entry) return;
    try {
      await fs.promises.unlink(entry.filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
    this.index.delete(mediaId);
    console.log(`[MediaStore] deleted → ${entry.filePath}`);
  }

  async clear(): Promise<void> {
    for (const mediaId of this.index.keys()) {
      await this.delete(mediaId);
    }
    console.log('[MediaStore] cleared all files');
  }

  list(): StoredMedia[] {
    return Array.from(this.index.values());
  }

  private extFromMime(mimeType: string | undefined): string {
    if (!mimeType) return '';
    const map: Record<string, string> = {
      'image/jpeg':             '.jpg',
      'image/png':              '.png',
      'image/webp':             '.webp',
      'video/mp4':              '.mp4',
      'video/3gpp':             '.3gp',
      'audio/ogg; codecs=opus': '.ogg',
      'audio/ogg':              '.ogg',
      'audio/mpeg':             '.mp3',
      'audio/mp4':              '.m4a',
    };
    return map[mimeType] ?? '';
  }
}

// ------------------------------------------------------------
// ReplyService — send outbound messages via the Cloud API
// ------------------------------------------------------------
export class ReplyService {
  private readonly baseUrl    = 'https://graph.facebook.com';
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v19.0';

  private get endpoint(): string {
    return `${this.baseUrl}/${this.apiVersion}/${process.env.PHONE_NUMBER_ID}/messages`;
  }

  private async post(payload: SendTextPayload | SendImagePayload | SendAudioPayload | SendVideoPayload): Promise<SendReplyResponse> {
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

  async sendText(to: string, body: string, previewUrl: boolean = false): Promise<SendReplyResponse> {
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

// ------------------------------------------------------------
// MessageService — parse + dispatch
// ------------------------------------------------------------
export class MessageService {
  private readonly media: MediaService;
  private readonly reply: ReplyService;
  private readonly store: MediaStore;

  constructor(store?: MediaStore) {
    this.media = new MediaService();
    this.reply = new ReplyService();
    this.store = store ?? new MediaStore();
  }

  getStore(): MediaStore {
    return this.store;
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
      const stored = await this.store.save(msg.mediaId, buffer, msg.mimeType);
      console.log(`[image stored] ${stored.filePath}`);

      const result = await this.reply.sendImage(msg.from, { mediaId: msg.mediaId }, msg.caption);
      console.log(`[image echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleAudio(msg: IAudioMessage): Promise<void> {
    console.log(`[audio] from ${msg.name}, voice note: ${msg.voice}`);
    if (msg.mediaId && msg.url) {
      const buffer = await this.media.fetch(msg.mediaId, msg.url);
      const stored = await this.store.save(msg.mediaId, buffer, msg.mimeType);
      console.log(`[audio stored] ${stored.filePath}`);

      const result = await this.reply.sendAudio(msg.from, { mediaId: msg.mediaId });
      console.log(`[audio echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleVideo(msg: IVideoMessage): Promise<void> {
    console.log(`[video] from ${msg.name}`);
    if (msg.mediaId && msg.url) {
      const buffer = await this.media.fetch(msg.mediaId, msg.url);
      const stored = await this.store.save(msg.mediaId, buffer, msg.mimeType);
      console.log(`[video stored] ${stored.filePath}`);

      const result = await this.reply.sendVideo(msg.from, { mediaId: msg.mediaId });
      console.log(`[video echoed] message id: ${result.messages[0]?.id}`);
    }
  }

  private async handleLocation(msg: ILocationMessage): Promise<void> {
    console.log(`[location] from ${msg.name}: ${msg.latitude}, ${msg.longitude}`);
    // reverse geocode, store, etc.
  }
}