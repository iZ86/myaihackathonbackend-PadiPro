import { Router } from "express";
import { expressHandler } from "@genkit-ai/express";
import { asyncHandler } from "../../utils/utils";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import ChatController from "./chat-controller";
import chatService from "./chat-service";

/** Routes for the Chat domain. */
class ChatRoute {
  router = Router();
  controller = new ChatController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Get request by Whatsapp to confirm if the server is able to receive messages
    this.router.get("/whatsapp", asyncHandler(this.controller.handleWhatsapp));

    // Handler for Whatsapp, will change data to standardised format for parsing in main shared function
    this.router.post(
      "/whatsapp",
      checkAuthTokenHeader,
      asyncHandler(this.controller.chatWhatsapp.bind(this.controller)),
    );

    // Handler for Webchat
    this.router.post("/webchat", checkAuthTokenHeader, asyncHandler(this.controller.chatWeb.bind(this.controller)));

    // Genkit related, using only for testing
    this.router.post("/flow", expressHandler(chatService.chatFlow));
  }
}

export default new ChatRoute().router;
