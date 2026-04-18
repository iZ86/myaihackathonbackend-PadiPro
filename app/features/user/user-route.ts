import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import UserController from "./user-controller";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import { userParamValidator, createUserBodyValidator, updateUserCoordsByMobileNoBodyValidator } from "./user-validator"


class UserRoute {
  router = Router();
  controller = new UserController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get("/", checkAuthTokenHeader, asyncHandler(this.controller.getUsers));
    this.router.get("/:mobile_no", checkAuthTokenHeader, userParamValidator, asyncHandler(this.controller.getUserByMobileNo));

    this.router.post("/", checkAuthTokenHeader, createUserBodyValidator, asyncHandler(this.controller.createUser));

    this.router.put("/:mobile_no/coords", checkAuthTokenHeader, userParamValidator, updateUserCoordsByMobileNoBodyValidator, asyncHandler(this.controller.updateUserCoordsByMobileNo));
  }
}

export default new UserRoute().router;
