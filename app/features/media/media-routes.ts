import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import MediaController from "./media-controller";
class MediaRoute {
  router = Router();
  controller = new MediaController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
  }
}

export default new MediaRoute().router;
