import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import TranslateController from "./translate-controller";

class TranslateRoute {
  router = Router();
  controller = new TranslateController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post("/", asyncHandler(this.controller.detectLanguage));
    }
}

export default new TranslateRoute().router;
