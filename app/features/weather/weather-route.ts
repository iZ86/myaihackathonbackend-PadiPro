import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import WeatherController from "./weather-controller";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import { weatherParamValidator } from "./weather-validator"

/** Route for the domain API. */
class WeatherRoute {
  router = Router();
  controller = new WeatherController();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get("/:mobile_no", checkAuthTokenHeader, weatherParamValidator, asyncHandler(this.controller.getWeatherByMobileNo));
    this.router.post("/", checkAuthTokenHeader, weatherParamValidator, asyncHandler(this.controller.saveWeather));
    this.router.put("/", checkAuthTokenHeader, weatherParamValidator, asyncHandler(this.controller.updateWeather));
  }
}

export default new WeatherRoute().router;
