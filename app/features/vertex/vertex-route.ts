import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import VertexController from "./vertex-controller";


class VertexRoute {
  router = Router();
  controller = new VertexController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
  }
}

export default new VertexRoute().router;
