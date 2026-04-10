import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import { WeatherData } from "./weather-model";
import weatherService from "./weather-service";


export default class WeatherController {

  async getWeatherByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);
    const result: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobileNo);
    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async saveWeather(req: Request, res: Response) {
    const mobile_no: string = req.body.mobile_no;
    const result: Result<WeatherData> = await weatherService.saveWeather(mobile_no);
    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async updateWeather(req: Request, res: Response) {
    const mobile_no: string = req.body.mobile_no;
    const result: Result<WeatherData> = await weatherService.updateWeather(mobile_no);
    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }
}
