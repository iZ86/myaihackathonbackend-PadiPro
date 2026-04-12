export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'location';
export type WhatsappMessage = ITextMessage | IImageMessage | IAudioMessage | IVideoMessage | ILocationMessage;

//all parameter with an undefined type is to prevent user sending nothing
export interface WhatsappBaseMessage {
  from:          string;
  messageId:     string;
  timestamp:     string;
  name:          string | undefined;
  waId:          string | undefined;
  phoneNumberId: string | undefined;
  type:          MessageType;
}

export interface ITextMessage extends WhatsappBaseMessage {
  type: 'text';
  body: string | undefined;
}

export interface IImageMessage extends WhatsappBaseMessage {
  type:     'image';
  mediaId:  string | undefined;
  url:      string | undefined;
  caption:  string | undefined;
  mimeType: string | undefined;
  sha256:   string | undefined;
}

export interface IAudioMessage extends WhatsappBaseMessage {
  type:     'audio';
  mediaId:  string | undefined;
  url:      string | undefined;
  mimeType: string | undefined;
  voice:    boolean | undefined;
  sha256:   string | undefined;
}

export interface IVideoMessage extends WhatsappBaseMessage {
  type:     'video';
  mediaId:  string | undefined;
  url:      string | undefined;
  mimeType: string | undefined;
  sha256:   string | undefined;
}

export interface ILocationMessage extends WhatsappBaseMessage {
  type:      'location';
  latitude:  number | undefined;
  longitude: number | undefined;
  locName:   string | undefined;
  address:   string | undefined;
}


//the payload format
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


//reply payload format
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

export type SendImagePayload = {
  messaging_product: 'whatsapp';
  recipient_type:    'individual';
  to:                string;
  type:              'image';
  image:
    | { id: string;   link?: never; caption?: string }
    | { link: string; id?: never;   caption?: string };
};

export type SendAudioPayload = {
  messaging_product: 'whatsapp';
  recipient_type:    'individual';
  to:                string;
  type:              'audio';
  audio:
    | { id: string;   link?: never }
    | { link: string; id?: never   };
};
 
// video supports an optional caption
export type SendVideoPayload = {
  messaging_product: 'whatsapp';
  recipient_type:    'individual';
  to:                string;
  type:              'video';
  video:
    | { id: string;   link?: never; caption?: string }
    | { link: string; id?: never;   caption?: string };
};

export interface SendReplyResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}