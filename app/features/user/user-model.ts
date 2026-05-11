export interface UserData {
  id: string;
  mobile_no: string;
  coords?: {
    _latitude: number;
    _longitude: number;
  };
  lang_whatsapp: string;
  lang_webchat: string;
}
