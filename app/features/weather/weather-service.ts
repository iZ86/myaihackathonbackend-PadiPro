
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { WeatherData, WeatherApiResponse } from "./weather-model";
import weatherRepository from "./weather-repository";
import { weatherServiceConfig } from "../../config/config";
import userService from "../user/user-service";
import { UserData } from "../user/user-model";

interface IWeatherService {
  getWeatherByMobileNo(mobile_no: string): Promise<Result<WeatherData>>;
}

class WeatherService implements IWeatherService {

  public async getWeatherByMobileNo(mobile_no: string): Promise<Result<WeatherData>> {
    const weather: WeatherData | undefined = await weatherRepository.getWeatherByMobileNo(mobile_no);
    if (!weather) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "User location is not set.", { mobile_no: mobile_no } as WeatherData);
    }
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, weather, "User weather record found.");
  }
  
  public async updateWeather(mobile_no: string): Promise<any> {

    // Check param exist.
    const userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

    if (!userResult.isSuccess()) {
      Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, userResult.getMessage());
    }

    // Make sure user has coords
    const user: UserData = userResult.getData();
    if (!user.coords) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "User location is not set.");
    }


    // Check if last updated_at was 4 hours ago
    let lastUpdateMs = 0;
    const weatherResult: Result<WeatherData> = await this.getWeatherByMobileNo(mobile_no);
    if (!weatherResult.isSuccess()) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, weatherResult.getMessage());
    }

    const weather: WeatherData = weatherResult.getData();

    if (weather.updated_at) {
      const dateObj = (typeof (weather.updated_at as any).toDate === 'function') 
        ? (weather.updated_at as any).toDate() 
        : new Date(weather.updated_at);

      lastUpdateMs = dateObj.getTime();
    }

    const fourHoursInMs = 4 * 60 * 60 * 1000;
    const currentTimeMs = Date.now();
    const isStale = (currentTimeMs - lastUpdateMs) > fourHoursInMs;
    if (!isStale) {
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, {}, "User weather record has already been updated in the past 4 hours.");
    }

    // 3. Get Weather API response
    const weatherApiResponse: WeatherApiResponse = (await weatherRepository.fetchWeatherApi(
      weatherServiceConfig.WEATHER_API_KEY, 
      user.coords._latitude, 
      user.coords._longitude
    )) as WeatherApiResponse;

    // 4. Update weather data
    const updatedData: WeatherData = {
      ...weather, 
      mobile_no: mobile_no,
      updated_at: new Date().toISOString() ,
      weatherCondition: weatherApiResponse.weatherCondition.type,
      temperature: weatherApiResponse.temperature,
      dewPoint: weatherApiResponse.dewPoint,
      relativeHumidity: weatherApiResponse.relativeHumidity,
      precipitation: weatherApiResponse.precipitation,
      thunderstormProbability: weatherApiResponse.thunderstormProbability,
      wind: weatherApiResponse.wind,
      cloudCover: weatherApiResponse.cloudCover,
    };

    await weatherRepository.updateWeather(mobile_no, updatedData);
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, updatedData, "User weather record updated.");
  }
  
  public async saveWeather(mobile_no: string): Promise<any> {

    // Check param exist.
    const userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

    if (!userResult.isSuccess()) {
      Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, userResult.getMessage());
    }

    // Make sure user has coords
    const user: UserData = userResult.getData();
    if (!user.coords) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "User location is not set.");
    }

    // 2. Check if weather record already exists
    const weather = await weatherRepository.getWeatherByMobileNo(mobile_no);
    if (weather) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "Weather record for this user already exists.");
    }

    // 2. Get Weather API response
    const weatherApiResponse: WeatherApiResponse = (await weatherRepository.fetchWeatherApi(
      weatherServiceConfig.WEATHER_API_KEY, 
      user.coords._latitude, 
      user.coords._longitude
    )) as WeatherApiResponse;

    // 3. Save weather data
    const updatedData: WeatherData = {
      mobile_no: mobile_no,
      updated_at: new Date().toISOString() ,
      weatherCondition: weatherApiResponse.weatherCondition.type,
      temperature: weatherApiResponse.temperature,
      dewPoint: weatherApiResponse.dewPoint,
      relativeHumidity: weatherApiResponse.relativeHumidity,
      precipitation: weatherApiResponse.precipitation,
      thunderstormProbability: weatherApiResponse.thunderstormProbability,
      wind: weatherApiResponse.wind,
      cloudCover: weatherApiResponse.cloudCover,
    };

    await weatherRepository.saveWeather(mobile_no, updatedData);
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, updatedData, "User weather record saved.");
  }
}

export default new WeatherService();
