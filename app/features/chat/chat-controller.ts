import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import { ChatInput, ChatOutput } from "./chat-model";
import chatService from "./chat-service";
import { RawWebhookBody } from "../whatsapp/whatsapp-model";
import { whatsappConfig } from "../../config/config";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";

/** Handles HTTP requests and delegates to ChatService. */
export default class ChatController {


  async handleWhatsapp(req: Request, res: Response) {
    const { "hub.mode": mode, "hub.challenge": challenge, "hub.verify_token": token } = req.query;

    if (mode === "subscribe" && token === whatsappConfig.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendResponse(ENUM_STATUS_CODES_FAILURE.FORBIDDEN);
  };

  async chatWhatsapp(req: Request<{}, {}, RawWebhookBody>, res: Response): Promise<void> {
    try {
      // Act immediately — WhatsApp retries if no 200 within 20s
      res.sendResponse(ENUM_STATUS_CODES_SUCCESS.OK);

      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      if (!value?.messages?.length) return; // status update or empty ping

      const result: Result<ChatOutput | string> = await chatService.chat(value);

      //multiple response to 1 request.
      if (result.isSuccess()) {
        // return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
        console.log(result.getStatusCode(), result.getMessage(), result.getData());
      } else if (result.isFailure()) {
        // return res.sendResponse(result.getStatusCode(), result.getMessage());
        console.log(result.getStatusCode(), result.getMessage());
      }
    } catch (err) {
      console.error("[Whatsapp] Error reading message:", err);
    }
  }

  // WIP
  async chatWeb(req: Request, res: Response) {
    const input: ChatInput = {
      mobile_no: req.body.mobile_no,
      message: req.body.message,
      media_url: req.body.media_url,
      media_name: req.body.media_name,
      media_type: req.body.media_type,
      created_by: req.body.created_by,
    };

    const result: Result<ChatOutput | string> = await chatService.chat(input);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }
}
