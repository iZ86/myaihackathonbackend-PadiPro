import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import UserController from "./user-controller";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import { userParamValidator, createUserBodyValidator, updateUserCoordsByMobileNoBodyValidator, updateUserLangByMobileNoBodyValidator } from "./user-validator";


class UserRoute {
  router = Router();
  controller = new UserController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get("/", checkAuthTokenHeader, asyncHandler(this.controller.getUsers));
    this.router.get("/:mobile_no", checkAuthTokenHeader, userParamValidator, asyncHandler(this.controller.getUserByMobileNo));
    this.router.get("/:mobile_no/diagnosis/history", userParamValidator, asyncHandler(this.controller.getDiagnosisHistoryByMobileNo));


    this.router.post("/", checkAuthTokenHeader, createUserBodyValidator, asyncHandler(this.controller.createUser));

    this.router.put("/:mobile_no/coords", checkAuthTokenHeader, userParamValidator, updateUserCoordsByMobileNoBodyValidator, asyncHandler(this.controller.updateUserCoordsByMobileNo));
    this.router.patch("/:mobile_no/lang", checkAuthTokenHeader, userParamValidator, updateUserLangByMobileNoBodyValidator, asyncHandler(this.controller.updateUserLangByMobileNo));
  }
}

export default new UserRoute().router;
