import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import VertexController from "./vertex-controller";
import { sendQueryVertexBodyValidator } from "./vertex-validator";


class VertexRoute {
  router = Router();
  controller = new VertexController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post("/session", checkAuthTokenHeader, asyncHandler(this.controller.createVertexSession));
    this.router.post("/query", checkAuthTokenHeader, sendQueryVertexBodyValidator, asyncHandler(this.controller.sendQueryVertex));
  }
}

export default new VertexRoute().router;
