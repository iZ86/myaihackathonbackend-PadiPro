import { Router } from "express";
import { expressHandler } from "@genkit-ai/express";
import { asyncHandler } from "../../utils/utils";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import GeminiController from "./gemma-controller";
import gemmaService from "./gemma-service";

/** Routes for the Chat domain. */
class GeminiRoute {
  router = Router();
  controller = new GeminiController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Might not need .bind
    this.router.post("/", checkAuthTokenHeader, asyncHandler(this.controller.chat.bind(this.controller)));

    // Genkit native route — exposes the flow directly (supports streaming via genkit/beta/client)
    this.router.post("/flow", expressHandler(gemmaService.gemmaChatFlow));
  }
}

export default new GeminiRoute().router;
