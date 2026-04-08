import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import { ChatInput, ChatOutput } from "./gemini-model";
import geminiService from "./gemini-service";

/** Handles HTTP requests and delegates to ChatService. */
export default class GeminiController {
  async chat(req: Request, res: Response) {
    const input: ChatInput = {
      message: req.body.message,
      history: req.body.history,
    };

    const result: Result<ChatOutput> = await geminiService.chat(input);

    return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
  }

}
