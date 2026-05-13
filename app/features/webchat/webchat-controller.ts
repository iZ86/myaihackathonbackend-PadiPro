import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import webchatService from "./webchat-service";
import { ChatHistory } from "../chat/chat-model";
import { UserData } from "../user/user-model";
import mediaService from "../media/media-service";
import { MediaData } from "../media/media-model";


export default class WebchatController {
  async generateUploadUrl(req: Request, res: Response) {
    const mobileNo: string = req.params.mobile_no as string;
    const fileName: string = req.body.fileName;
    const contentType: string = req.body.contentType;

    const result = await webchatService.generateUploadUrl(mobileNo, fileName, contentType);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async getWebchatHistory(req: Request, res: Response) {
    const mobile_no: string = String(req.params.mobile_no);

    const result: Result<ChatHistory[]> = await webchatService.getWebChatHistory(mobile_no);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async updateUserCoordsByMobileNo(req: Request, res: Response) {
    const mobile_no: string = String(req.params.mobile_no);
    const lat: number = Number(req.body.lat);
    const long: number = Number(req.body.long);

    const result: Result<UserData> = await webchatService.updateUserCoordsByMobileNo(mobile_no, lat, long);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async saveMediaMetaDataByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);
    const fileName: string = req.body.fileName;
    const mimeType: string = req.body.mimeType;
    const storagePath: string = req.body.storagePath;
    const downloadUrl: string = req.body.downloadUrl;
    const caption: string = req.body.caption;
    const fileType: string = req.body.fileType;

    try {
      await webchatService.makeFilePublic(storagePath);
    } catch (error) {
      throw new Error("Failed to make file public", { cause: error });
    }

    let result: Result<MediaData>;

    switch (fileType) {
      case 'image':
        result = await mediaService.saveImageMetaData(fileName, mimeType, storagePath, downloadUrl, mobileNo, caption);
        break;
      case 'audio':
        result = await mediaService.saveAudioMetaData(fileName, mimeType, storagePath, downloadUrl, mobileNo, caption);
        break;
      case 'video':
        result = await mediaService.saveVideoMetaData(fileName, mimeType, storagePath, downloadUrl, mobileNo, caption);
        break;
      default:
        result = await mediaService.saveImageMetaData(fileName, mimeType, storagePath, downloadUrl, mobileNo, caption);
        break;
    }

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }
}
