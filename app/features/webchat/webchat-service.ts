import { Result } from "../../../libs/Result";
import { ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { firebaseConfig, firestoreConfig, speechConfig } from "../../config/config";
import { Storage } from '@google-cloud/storage';
import { ChatHistory } from "../chat/chat-model";
import chatHistory from "../chat/chat-repository";
import mainService from "../main/main-service";
import { UserData } from "../user/user-model";

interface IWebchatService {
  generateUploadUrl(mobileNo: string, fileName: string, contentType: string): Promise<Result<UploadUrls>>;
  getWebChatHistory(mobile_no: string): Promise<Result<ChatHistory[]>>;
  updateUserCoordsByMobileNo(mobile_no: string, lat: number, long: number): Promise<Result<UserData>>;
}

class WebchatService implements IWebchatService {
  private storage: Storage;
  private bucket;

  constructor() {
    this.storage = new Storage({
      projectId: firestoreConfig.PROJECT_ID,
    });
    this.bucket = this.storage.bucket(firebaseConfig.BUCKET);
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

    const uploadFileName = `${dir}/${mobileNo}/${Date.now()}-${fileName}`;
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
    const response = await chatHistory.getChatHistory(mobile_no, 'webchat') ?? [];

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, response, "Successfully get web chat history");
  }

  async updateUserCoordsByMobileNo(mobile_no: string, lat: number, long: number): Promise<Result<UserData>> {
    const response: Result<UserData> = await mainService.handleLocation(mobile_no, lat, long);

    if (response.isFailure()) {
      throw new Error(`handleLocation failed to updateUserCoords ${response.getMessage()}`);
    }
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, response.getData(), response.getMessage());
  }
}

export default new WebchatService();
