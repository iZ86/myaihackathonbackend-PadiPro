import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import { WeatherData } from "./weather-model";
import weatherService from "./weather-service";

/** Used to handle HTTP requests,
 * Organize data to be sent to service.
 * Controls which service method to use.
 */
export default class WeatherController {

  async getWeatherByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);
    const result: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobileNo);
    return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
  }
  
  async saveWeather(req: Request, res: Response) {
    const { mobile_no } = req.body;
    const result: Result<WeatherData> = await weatherService.saveWeather(mobile_no);
    return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
  }

  async updateWeather(req: Request, res: Response) {
    const { mobile_no } = req.body;
    const result: Result<WeatherData> = await weatherService.updateWeather(mobile_no);
    return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
  }
}
