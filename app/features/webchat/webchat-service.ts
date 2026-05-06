import { Result } from "../../../libs/Result";
import { ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { db } from "../../database/db-connection";
import { Storage } from '@google-cloud/storage';

interface IWebchatService {
  generateUploadUrl(fileName: string, contentType: string): Promise<Result<string>>;
}

class WebchatService implements IWebchatService {
  private storage: Storage;
  private bucket;

  constructor() {
    this.storage = new Storage({
      projectId: 'myai-hackathon-beta',
      // keyFilename: 'service-account.json',
    });
    this.bucket = this.storage.bucket('myai-hackathon-beta.firebasestorage.app');
  }

  public async generateUploadUrl(fileName: string, contentType: string): Promise<Result<string>> {
    let dir: string = 'image';

    switch (contentType) {
      case 'image':
        dir = 'image';
        break;

      case 'video':
        dir = 'video';
        break;

      case 'audio':
        dir = 'audio';
        break;

      default:
        dir = 'image';
        break;
    }

    const uploadFileName = `${dir}/${Date.now()}-${fileName}`;
    const file = this.bucket.file(uploadFileName);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 5 * 60 * 1000, // 5 min
      contentType: contentType,
    });

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, url, "Upload url created");
  }

}

export default new WebchatService();
