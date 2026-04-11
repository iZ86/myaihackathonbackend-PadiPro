// ============================================================
// models/message.model.ts
// ============================================================

export interface WhatsappBaseMessage {
  from:          string;
  messageId:     string;
  timestamp:     string;
  name:          string | undefined;
  waId:          string | undefined;
  phoneNumberId: string | undefined;
  type:          MessageType;
}

export interface TextMessage extends WhatsappBaseMessage {
  type: 'text';
  body: string | undefined;
}

export interface ImageMessage extends WhatsappBaseMessage {
  type:     'image';
  mediaId:  string | undefined;
  url:      string | undefined;
  caption:  string | undefined;
  mimeType: string | undefined;
  sha256:   string | undefined;
}

export interface AudioMessage extends WhatsappBaseMessage {
  type:     'audio';
  mediaId:  string | undefined;
  url:      string | undefined;
  mimeType: string | undefined;
  voice:    boolean | undefined;
  sha256:   string | undefined;
}

export interface VideoMessage extends WhatsappBaseMessage {
  type:     'video';
  mediaId:  string | undefined;
  url:      string | undefined;
  mimeType: string | undefined;
  sha256:   string | undefined;
}

export interface LocationMessage extends WhatsappBaseMessage {
  type:      'location';
  latitude:  number | undefined;
  longitude: number | undefined;
  locName:   string | undefined;
  address:   string | undefined;
}

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'location';

export type WhatsAppMessage =
  | TextMessage
  | ImageMessage
  | AudioMessage
  | VideoMessage
  | LocationMessage;

// ---- Raw webhook payload types ----------------------------

export interface RawWebhookBody {
  object: string;
  entry:  RawEntry[];
}

export interface RawEntry {
  id:      string;
  changes: RawChange[];
}

export interface RawChange {
  value: RawValue;
  field: string;
}

export interface RawValue {
  messaging_product: string;
  metadata:          RawMetadata;
  contacts?:         RawContact[];
  messages?:         RawMessage[];
}

export interface RawMetadata {
  display_phone_number: string;
  phone_number_id:      string;
}

export interface RawContact {
  profile: { name: string };
  wa_id:   string;
}

export interface RawMessage {
  from:      string;
  id:        string;
  timestamp: string;
  type:      MessageType;
  text?:     { body: string };
  image?:    RawMedia & { caption?: string };
  audio?:    RawMedia & { voice?: boolean };
  video?:    RawMedia;
  location?: RawLocation;
}

export interface RawMedia {
  id:        string;
  url:       string;
  mime_type: string;
  sha256:    string;
}

export interface RawLocation {
  latitude:  number;
  longitude: number;
  name?:     string;
  address?:  string;
}

// ---- Outbound reply payload types -------------------------

export interface SendTextPayload {
  messaging_product: 'whatsapp';
  recipient_type:    'individual';
  to:                string;
  type:              'text';
  text: {
    body:        string;
    preview_url: boolean;
  };
}

export interface SendReplyResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}