export interface MediaData {
  from: string;
  mediaName: string;
  mimeType: string;
  storage_path: string;
  download_url: string;
  created_at: string;
  caption?: string;
  sha256?: string;
  detections?: Array<MediaOutputDetection>;
  document?: string;
}

interface MediaOutputDetection {
  disease: string;
  severity: number;
  score: number;
}
export interface DocumentData extends MediaData {
  document_disease: string;
}

export interface MediaFileData {
  mediaName: string;
  storage_path: string;
  download_url: string;
}

export interface LocationTutorialImages {
  step_1: string;
  step_2: string;
  step_3: string;
}
