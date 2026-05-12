export interface MediaData {
  from: string;
  mediaName: string;
  mimeType: string;
  storage_path: string;
  download_url: string;
  created_at: string;
  caption?: string;
  sha256?: string;
}

export interface DocumentData extends MediaData {
  document_disease: string;
  document_for?: string;
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
