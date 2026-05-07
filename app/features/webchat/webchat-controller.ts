import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import webchatService from "./webchat-service";
import { ChatHistory } from "../gemma/gemma-model";


export default class WebchatController {
  async generateUploadUrl(req: Request, res: Response) {
    const fileName: string = req.body.fileName;
    const contentType: string = req.body.contentType;

    const result: Result<string> = await webchatService.generateUploadUrl(fileName, contentType);

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
}
