import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import vertexService from "../vertex/vertex-service";
import { VertexAnswerQueryData, VertexSessionInfoData } from "../vertex/vertex-model";
import { WeatherData } from "../weather/weather-model";
import weatherService from "../weather/weather-service";

interface IMainService {
  handleText(mobile_no: string, text: string): Promise<Result<string>>;
}

// Testing to hold vertex sessions
const userVertexSession: { [mobile_no: string]: string } = {};

class MainService implements IMainService {

  public async handleText(mobile_no: string, text: string): Promise<Result<string>> {

    await this.syncUserWeather(mobile_no);

    const weatherQuery: string = await this.generateWeatherQuery(mobile_no);


    const session: string = await this.getOrCreateVertexSession(mobile_no);


    const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(text + weatherQuery, session);


    const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();

    if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "I specialize in rice paddy disease analysis. Could you clarify how your question relates to crop health?", "handleText success.");
    } else {
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, sendQueryVertex.answer.answerText, "handleText success.");
    }
  }

  private async syncUserWeather(mobile_no: string): Promise<undefined> {

    const getWeatherResult: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobile_no);

    if (getWeatherResult.isSuccess()) {

      const updateWeatherResult: Result<WeatherData> = await weatherService.updateWeather(mobile_no);

      if (updateWeatherResult.isFailure() &&
        ((updateWeatherResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.NOT_FOUND && updateWeatherResult.getMessage() !== "User location is not set.") ||
          (updateWeatherResult.getStatusCode() !== ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS))) {

        throw new Error(`handleText had issue with updateWeather: ${updateWeatherResult.getMessage()}`);
      }


    } else if (getWeatherResult.isFailure() && getWeatherResult.getMessage() === "User weather not found.") {

      const saveWeatherResult: Result<WeatherData> = await weatherService.saveWeather(mobile_no);

      if (saveWeatherResult.isFailure() && saveWeatherResult.getMessage() !== "User location is not set.") {
        throw new Error(`handleText had issue with saveWeather: ${saveWeatherResult.getMessage()}`);
      }

    } else {
      throw new Error("handleText failed to get weather.");
    }
  }

  private async generateWeatherQuery(mobile_no: string): Promise<string> {

    const weatherResult: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobile_no);

    let weatherQuery: string = "";

    if (weatherResult.isSuccess()) {
      const weather: WeatherData = weatherResult.getData();
      const condition = weather.weatherCondition?.replace(/_/g, " ").toLowerCase();
      const temp = `${weather.temperature?.degrees}°${weather.temperature?.unit === "CELSIUS" ? "C" : "F"}`;
      const feelsLike = weather.dewPoint ? `dew point ${weather.dewPoint.degrees}°C` : "";
      const humidity = `humidity ${weather.relativeHumidity}%`;
      const wind = `wind ${weather.wind?.speed?.value} ${weather.wind?.speed?.unit?.replace(/_/g, " ").toLowerCase()} from ${weather.wind?.direction?.cardinal?.replace(/_/g, " ")}`;
      const gusts = weather.wind?.gust?.value ? `, gusting to ${weather.wind.gust.value} km/h` : "";
      const cloud = `cloud cover ${weather.cloudCover}%`;
      const rainChance = `${weather.precipitation?.probability?.percent}% chance of ${weather.precipitation?.probability?.type?.toLowerCase()}`;
      const thunderChance = (weather.thunderstormProbability ? weather.thunderstormProbability > 0 : false) ? `, ${weather.thunderstormProbability}% chance of thunderstorms` : "";
      const qpf = (weather.precipitation?.qpf.quantity ? weather.precipitation?.qpf?.quantity > 0 : false)
        ? `, expected rainfall ${weather.precipitation?.qpf.quantity} ${weather.precipitation?.qpf.unit.toLowerCase()}`
        : "";


      weatherQuery =
        "\nAdditionally, here are the current weather conditions that you may reference when tailoring the personalized solution plan: " +
        `\nCurrent weather conditions:` +
        `\n- Condition: ${condition}` +
        `\n- Temperature: ${temp}, ${feelsLike}, ${humidity}` +
        `\n- Wind: ${wind}${gusts}` +
        `\n- Sky: ${cloud}` +
        `\n- Precipitation: ${rainChance}${thunderChance}${qpf}`;
    } else if (weatherResult.isFailure() && weatherResult.getMessage() !== "User weather not found.") {
      // If the weather is still not set by here. Means that the user has no location set.
      // Hence, don't throw error unless its something else other than no user location set.
      throw new Error(`handleText could not getWeather due to other reasons: ${weatherResult.getMessage()}`);
    }

    return weatherQuery;
  }

  private async getOrCreateVertexSession(mobile_no: string): Promise<string> {
    return userVertexSession[mobile_no] ?? await (async () => {
      const createVertexSessionResult: Result<VertexSessionInfoData> = await vertexService.createVertexSession();
      if (createVertexSessionResult.isSuccess()) {
        const vertexSession: VertexSessionInfoData = createVertexSessionResult.getData();
        userVertexSession[mobile_no] = vertexSession.session;
        return vertexSession.session;
      }
      throw new Error("handleText failed to create vertex session.");
    })();
  }

}

export default new MainService();
