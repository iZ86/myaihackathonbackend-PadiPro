import { Result } from "../../../libs/Result";
import { ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { speechConfig } from "../../config/config";
import { db } from "../../database/db-connection";
import { Storage } from '@google-cloud/storage';
import { ChatHistory } from "../gemma/gemma-model";
import gemmaRepository from "../gemma/gemma-repository";

interface IWebchatService {
  generateUploadUrl(fileName: string, contentType: string): Promise<Result<string>>;
  getWebChatHistory(mobile_no: string): Promise<Result<ChatHistory[]>>;
}

class WebchatService implements IWebchatService {
  private storage: Storage;
  private bucket;

  constructor() {
    this.storage = new Storage({
      projectId: speechConfig.GOOGLE_CLOUD_PROJECT,
    });
    this.bucket = this.storage.bucket('myai-hackathon-beta.firebasestorage.app');
  }

  async generateUploadUrl(fileName: string, contentType: string): Promise<Result<string>> {
    let dir: string = 'image';

    if (contentType.includes('image')) {
      dir = 'images';
    } else if (contentType.includes('video')) {
      dir = 'videos';
    } else if (contentType.includes('audio')) {
      dir = 'audios';
    } else {
      dir = 'images';
    }

    const uploadFileName = `${dir}/${Date.now()}-${fileName}`;
    const file = this.bucket.file(uploadFileName);

    try {
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 5 * 60 * 1000, // 5 min
      });
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, url, "Upload url created");
    } catch (error) {
      console.error('Fetch Error:', error);
      throw error;
    }
  }

  async getWebChatHistory(mobile_no: string): Promise<Result<ChatHistory[]>> {
    const response = await gemmaRepository.getChatHistory(mobile_no, 'webchat') ?? [];

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, response, "Successfully get web chat history");
  }
}

export default new WebchatService();
