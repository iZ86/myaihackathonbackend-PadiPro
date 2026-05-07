import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import { ChatInput, ChatOutput } from "./gemma-model";
import gemmaService from "./gemma-service";

/** Handles HTTP requests and delegates to ChatService. */
export default class GemmaController {
  async chat(req: Request, res: Response) {
    const input: ChatInput = {
      mobile_no: req.body.mobile_no,
      message: req.body.message,
      image_url: req.body.image_url,
    };

    const result: Result<ChatOutput> = await gemmaService.chat(input);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }
}
