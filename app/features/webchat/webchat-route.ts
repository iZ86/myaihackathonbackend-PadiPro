import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import WebchatController from "./webchat-controller";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import { generateUploadUrlrBodyValidator } from "./webchat-validator";

class WebchatRoute {
  router = Router();
  controller = new WebchatController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post("/upload/url", checkAuthTokenHeader, generateUploadUrlrBodyValidator, asyncHandler(this.controller.generateUploadUrl));
    this.router.get("/history/:mobile_no", checkAuthTokenHeader, asyncHandler(this.controller.getWebchatHistory));
  }
}

export default new WebchatRoute().router;
